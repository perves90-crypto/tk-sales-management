import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Save, RefreshCw, ClipboardList } from 'lucide-react';

const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  return parts;
};

const blankForm = () => ({
  report_date: today(),
  visit_count: '',
  productive_visit: '',
  order_memo: '',
  order_value: '',
  ims_memo: '',
  ims_value: '',
  remarks: ''
});

export default function DailySalesReport({ profile, userId }) {
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('sales_reports')
      .select('id,report_date,visit_count,productive_visit,order_memo,order_value,ims_memo,ims_value,remarks,status')
      .eq('so_id', userId)
      .order('report_date', { ascending: false })
      .limit(10);
    if (loadError) setError('আগের রিপোর্ট লোড হয়নি: ' + loadError.message);
    else setReports(data || []);
    setLoading(false);
  };

  useEffect(() => { loadReports(); }, [userId]);

  const update = (field, value) => setForm(old => ({ ...old, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (String(profile?.role || '').toUpperCase() !== 'SO') {
      setError('দৈনিক রিপোর্ট এন্ট্রি শুধু Sales Officer (SO) অ্যাকাউন্ট থেকে করা যাবে।');
      return;
    }
    if (!profile?.area_id) {
      setError('আপনার Profile-এ Area নির্ধারিত নেই। ASM/RSM-কে Area সেট করতে বলুন।');
      return;
    }
    const numericFields = ['visit_count', 'productive_visit', 'order_memo', 'order_value', 'ims_memo', 'ims_value'];
    for (const field of numericFields) {
      if (form[field] === '' || !Number.isFinite(Number(form[field])) || Number(form[field]) < 0) {
        setError('সব সংখ্যার ঘর পূরণ করুন। সংখ্যা শূন্য বা তার বেশি হতে হবে।');
        return;
      }
    }
    if (Number(form.productive_visit) > Number(form.visit_count)) {
      setError('Productive Visit, মোট Visit-এর চেয়ে বেশি হতে পারবে না।');
      return;
    }

    setBusy(true);
    const payload = {
      so_id: userId,
      area_id: profile.area_id,
      report_date: form.report_date,
      visit_count: Number(form.visit_count),
      productive_visit: Number(form.productive_visit),
      order_memo: Number(form.order_memo),
      order_value: Number(form.order_value),
      ims_memo: Number(form.ims_memo),
      ims_value: Number(form.ims_value),
      remarks: form.remarks.trim() || null
    };
    const { error: saveError } = await supabase.from('sales_reports').insert(payload);
    setBusy(false);
    if (saveError) {
      setError(saveError.code === '42501'
        ? 'রিপোর্ট সংরক্ষণ হয়নি: Supabase sales_reports টেবিলে SO-এর INSERT RLS Policy চালু করতে হবে।'
        : 'রিপোর্ট সংরক্ষণ হয়নি: ' + saveError.message);
      return;
    }
    setNotice('দৈনিক সেলস রিপোর্ট সফলভাবে জমা হয়েছে।');
    setForm(blankForm());
    await loadReports();
  };

  const money = value => Number(value || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 });

  return <div className="daily-report-area">
    <div className="notice"><ClipboardList size={19}/><div><strong>Sales Officer-এর দৈনিক রিপোর্ট</strong><p>প্রতিদিনের Visit, Order ও IMS-এর প্রকৃত তথ্য লিখে রিপোর্ট জমা দিন।</p></div></div>
    {String(profile?.role || '').toUpperCase() !== 'SO' && (
      <div className="admin-alert">এই ফর্মটি Sales Officer (SO) অ্যাকাউন্টের জন্য। বর্তমান Role: {profile?.role || 'লোড হচ্ছে'}.</div>
    )}
    {error && <div className="admin-alert">{error}</div>}
    {notice && <div className="admin-success">{notice}</div>}
    <section className="admin-panel-card">
      <div className="admin-card-heading"><div><h2>দৈনিক রিপোর্ট এন্ট্রি</h2><p>তারিখ ও সব পরিমাণ যাচাই করে জমা দিন।</p></div><ClipboardList/></div>
      <form className="daily-report-form" onSubmit={submit}>
        <label>রিপোর্টের তারিখ<input type="date" value={form.report_date} max={today()} onChange={e=>update('report_date',e.target.value)} required /></label>
        <label>মোট মার্কেট ভিজিট<input type="number" min="0" step="1" inputMode="numeric" value={form.visit_count} onChange={e=>update('visit_count',e.target.value)} placeholder="যেমন: ৩০" required /></label>
        <label>Productive Visit<input type="number" min="0" step="1" inputMode="numeric" value={form.productive_visit} onChange={e=>update('productive_visit',e.target.value)} placeholder="যেমন: ২০" required /></label>
        <label>Order Memo সংখ্যা<input type="number" min="0" step="1" inputMode="numeric" value={form.order_memo} onChange={e=>update('order_memo',e.target.value)} placeholder="যেমন: ১৮" required /></label>
        <label>Order Value (৳)<input type="number" min="0" step="0.01" inputMode="decimal" value={form.order_value} onChange={e=>update('order_value',e.target.value)} placeholder="যেমন: ২৫০০০" required /></label>
        <label>IMS Memo সংখ্যা<input type="number" min="0" step="1" inputMode="numeric" value={form.ims_memo} onChange={e=>update('ims_memo',e.target.value)} placeholder="যেমন: ১৫" required /></label>
        <label>IMS Value (৳)<input type="number" min="0" step="0.01" inputMode="decimal" value={form.ims_value} onChange={e=>update('ims_value',e.target.value)} placeholder="যেমন: ১৮০০০" required /></label>
        <label className="daily-report-wide">মন্তব্য / সমস্যা<textarea rows="3" value={form.remarks} onChange={e=>update('remarks',e.target.value)} placeholder="প্রয়োজনে মন্তব্য লিখুন" /></label>
        <div className="daily-report-actions"><button type="button" className="admin-refresh" disabled={busy} onClick={()=>{setForm(blankForm());setError('');setNotice('');}}><RefreshCw size={15}/> ফর্ম রিসেট</button><button className="primary-btn" disabled={busy || String(profile?.role || '').toUpperCase() !== 'SO'}>{busy ? 'জমা হচ্ছে…' : 'রিপোর্ট জমা দিন'} <Save size={16}/></button></div>
      </form>
    </section>
    <div className="section-title"><h2>আমার সাম্প্রতিক রিপোর্ট</h2><button className="admin-refresh" onClick={loadReports}><RefreshCw size={14}/> রিফ্রেশ</button></div>
    <section className="team-list-card">
      {loading ? <p className="area-state">রিপোর্ট লোড হচ্ছে…</p> : reports.length === 0 ? <p className="area-state">এখনো কোনো রিপোর্ট পাওয়া যায়নি।</p> : reports.map(report => (
        <article className="daily-report-row" key={report.id}>
          <div className="daily-report-row-head"><strong>{report.report_date}</strong><span className="member-active">{report.status || 'জমা হয়েছে'}</span></div>
          <div className="daily-report-metrics">
            <span>Visit <b>{money(report.visit_count)}</b></span>
            <span>Productive <b>{money(report.productive_visit)}</b></span>
            <span>Order Memo <b>{money(report.order_memo)}</b></span>
            <span>Order <b>৳{money(report.order_value)}</b></span>
            <span>IMS Memo <b>{money(report.ims_memo)}</b></span>
            <span>IMS <b>৳{money(report.ims_value)}</b></span>
          </div>
          {report.remarks && <p className="muted">{report.remarks}</p>}
        </article>
      ))}
    </section>
  </div>;
}
