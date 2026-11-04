import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { CheckCircle2, RefreshCw, Pencil, Trash2, RotateCcw, Save, X, ClipboardCheck } from 'lucide-react';

const fields = [
  ['report_date', 'রিপোর্টের তারিখ', 'date'],
  ['visit_count', 'মোট মার্কেট ভিজিট', 'number'],
  ['productive_visit', 'Productive Visit', 'number'],
  ['order_memo', 'Order Memo', 'number'],
  ['order_value', 'Order Value (৳)', 'number'],
  ['ims_memo', 'IMS Memo', 'number'],
  ['ims_value', 'IMS Value (৳)', 'number']
];
const fmt = v => Number(v || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 });

export default function IMSApproveASM({ profile, userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState('');
  const [edit, setEdit] = useState({});
  const [rollbackReason, setRollbackReason] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (String(profile?.role || '').toUpperCase() !== 'ASM' || !profile?.area_id) {
      setRows([]); setLoading(false);
      if (profile && String(profile.role || '').toUpperCase() !== 'ASM') setError('এই প্যানেল শুধু ASM অ্যাকাউন্টের জন্য।');
      else if (profile && !profile.area_id) setError('আপনার Profile-এ Area সেট করা নেই। RSM-কে Area সেট করতে বলুন।');
      return;
    }
    const { data, error: queryError } = await supabase
      .from('sales_reports')
      .select('id,so_id,area_id,report_date,visit_count,productive_visit,order_memo,order_value,ims_memo,ims_value,remarks,status,created_at')
      .eq('area_id', profile.area_id)
      .eq('status', 'pending_asm')
      .order('report_date', { ascending: false });
    if (queryError) setError('ASM-এর Pending IMS রিপোর্ট আনা যায়নি: ' + queryError.message);
    else {
      const reportRows = data || [];
      if (reportRows.length) {
        const ids = [...new Set(reportRows.map(r => r.so_id).filter(Boolean))];
        const { data: people, error: peopleError } = await supabase.from('profiles').select('id,employee_id,full_name,role').in('id', ids);
        if (peopleError) setError('রিপোর্ট এসেছে, কিন্তু SO-এর নাম আনা যায়নি: ' + peopleError.message);
        const byId = Object.fromEntries((people || []).map(p => [p.id, p]));
        setRows(reportRows.map(r => ({ ...r, so: byId[r.so_id] || null })));
      } else setRows([]);
    }
    setLoading(false);
  }, [profile?.role, profile?.area_id]);

  useEffect(() => { load(); }, [load]);

  const action = async (row, nextStatus, label) => {
    setError(''); setNotice('');
    const reason = (rollbackReason[row.id] || '').trim();
    if (nextStatus === 'returned_to_so' && !reason) {
      setError('Rollback করার আগে SO-কে সংশোধনের কারণ লিখুন।');
      return;
    }
    if (!window.confirm((row.so?.full_name || row.so?.employee_id || 'SO') + ' — ' + row.report_date + ' রিপোর্টে "' + label + '" করবেন?')) return;
    setBusyId(row.id);
    const updateData = { status: nextStatus };
    if (nextStatus === 'pending_rsm') {
      const { data: authData } = await supabase.auth.getUser();
      updateData.asm_reviewed_by = authData?.user?.id || userId;
      updateData.asm_reviewed_at = new Date().toISOString();
    }
    if (nextStatus === 'returned_to_so') {
      updateData.remarks = [row.remarks, 'ASM Rollback: ' + reason].filter(Boolean).join('\n');
    }
    const { error: updateError } = await supabase.from('sales_reports').update(updateData).eq('id', row.id).eq('area_id', profile.area_id).eq('status', 'pending_asm');
    setBusyId('');
    if (updateError) setError(label + ' সম্পন্ন হয়নি: ' + updateError.message);
    else { setNotice('রিপোর্টে ' + label + ' সম্পন্ন হয়েছে।'); setRollbackReason(old => ({ ...old, [row.id]: '' })); await load(); }
  };

  const startEdit = row => {
    setEditingId(row.id);
    setEdit({
      report_date: row.report_date, visit_count: String(row.visit_count ?? 0),
      productive_visit: String(row.productive_visit ?? 0), order_memo: String(row.order_memo ?? 0),
      order_value: String(row.order_value ?? 0), ims_memo: String(row.ims_memo ?? 0),
      ims_value: String(row.ims_value ?? 0), remarks: row.remarks || ''
    });
    setError(''); setNotice('');
  };

  const saveEdit = async row => {
    setError(''); setNotice('');
    for (const key of ['visit_count','productive_visit','order_memo','order_value','ims_memo','ims_value']) {
      if (edit[key] === '' || !Number.isFinite(Number(edit[key])) || Number(edit[key]) < 0) {
        setError('সব সংখ্যার ঘর সঠিকভাবে পূরণ করুন।'); return;
      }
    }
    if (Number(edit.productive_visit) > Number(edit.visit_count)) { setError('Productive Visit, মোট Visit-এর চেয়ে বেশি হতে পারবে না।'); return; }
    if (Number(edit.order_memo) > Number(edit.productive_visit)) { setError('Order Memo সংখ্যা Productive Visit-এর চেয়ে বেশি। তথ্য যাচাই করুন।'); return; }
    if (!window.confirm('এই রিপোর্টের তথ্য পরিবর্তন করে সংরক্ষণ করবেন?')) return;
    setBusyId(row.id);
    const payload = {
      report_date: edit.report_date, visit_count: Number(edit.visit_count),
      productive_visit: Number(edit.productive_visit), order_memo: Number(edit.order_memo),
      order_value: Number(edit.order_value), ims_memo: Number(edit.ims_memo),
      ims_value: Number(edit.ims_value), remarks: edit.remarks.trim() || null
    };
    const { error: saveError } = await supabase.from('sales_reports').update(payload)
      .eq('id', row.id).eq('area_id', profile.area_id).eq('status', 'pending_asm');
    setBusyId('');
    if (saveError) setError('Edit সংরক্ষণ হয়নি: ' + saveError.message);
    else { setEditingId(''); setNotice('রিপোর্টের সংশোধিত তথ্য সংরক্ষণ হয়েছে।'); await load(); }
  };

  const deleteReport = async row => {
    setError(''); setNotice('');
    if (!window.confirm((row.so?.full_name || row.so?.employee_id || 'SO') + '-এর ' + row.report_date + ' রিপোর্ট স্থায়ীভাবে Delete করবেন?')) return;
    setBusyId(row.id);
    const { error: deleteError } = await supabase.from('sales_reports').delete()
      .eq('id', row.id).eq('area_id', profile.area_id).eq('status', 'pending_asm');
    setBusyId('');
    if (deleteError) setError('Delete হয়নি: ' + deleteError.message);
    else { setNotice('Pending রিপোর্ট Delete করা হয়েছে।'); await load(); }
  };

  if (String(profile?.role || '').toUpperCase() !== 'ASM') return <div className="admin-alert">IMS Approve for ASM শুধু ASM Role-এ ব্যবহার করা যাবে।</div>;

  return <div className="ims-approval-area">
    <div className="notice"><ClipboardCheck size={19}/><div><strong>IMS Approve for ASM</strong><p>আপনার Area-এর SO-দের জমা দেওয়া Pending রিপোর্ট যাচাই করুন। Approve করলে রিপোর্ট RSM-এর Review প্যানেলে যাবে।</p></div></div>
    {error && <div className="admin-alert">{error}</div>}{notice && <div className="admin-success">{notice}</div>}
    <div className="section-title"><h2>ASM-এর জন্য অপেক্ষমাণ IMS রিপোর্ট ({rows.length.toLocaleString('bn-BD')})</h2><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={14}/> রিফ্রেশ</button></div>
    {loading ? <div className="team-list-card"><p className="area-state">IMS রিপোর্ট লোড হচ্ছে…</p></div>
      : rows.length === 0 ? <div className="team-list-card"><p className="area-state">আপনার Area-তে ASM Approval-এর জন্য কোনো Pending রিপোর্ট নেই। রিপোর্ট জমা হওয়ার পর এখানে আসবে।</p></div>
      : rows.map(row => <section className="admin-panel-card ims-report-card" key={row.id}>
        <div className="ims-report-header"><div><h3>{row.so?.full_name || 'SO নাম পাওয়া যায়নি'}</h3><p>Employee ID: {row.so?.employee_id || '—'} · তারিখ: {row.report_date}</p></div><span className="ims-pending-badge">Pending ASM</span></div>
        {editingId === row.id ? <div className="ims-edit-grid">
          {fields.map(([key,label,type]) => <label key={key}>{label}<input type={type} min={type==='number'?'0':undefined} step={type==='number'?(key.includes('value')?'0.01':'1'):undefined} value={edit[key] ?? ''} onChange={e=>setEdit(old=>({...old,[key]:e.target.value}))} required /></label>)}
          <label className="ims-edit-wide">মন্তব্য / সংশোধনের তথ্য<textarea rows="2" value={edit.remarks} onChange={e=>setEdit(old=>({...old,remarks:e.target.value}))}/></label>
          <div className="ims-action-row"><button className="admin-refresh" onClick={()=>setEditingId('')}><X size={15}/> বাতিল</button><button className="primary-btn" disabled={busyId===row.id} onClick={()=>saveEdit(row)}><Save size={15}/> {busyId===row.id?'সংরক্ষণ হচ্ছে…':'Edit সংরক্ষণ'}</button></div>
        </div> : <>
          <div className="ims-report-metrics">
            <span>Market Visit <b>{fmt(row.visit_count)}</b></span><span>Productive Visit <b>{fmt(row.productive_visit)}</b></span>
            <span>Order Memo <b>{fmt(row.order_memo)}</b></span><span>Order Value <b>৳{fmt(row.order_value)}</b></span>
            <span>IMS Memo <b>{fmt(row.ims_memo)}</b></span><span>IMS Value <b>৳{fmt(row.ims_value)}</b></span>
          </div>
          {row.remarks && <p className="ims-remarks">মন্তব্য: {row.remarks}</p>}
          <div className="ims-action-row"><button className="ims-edit-btn" disabled={!!busyId} onClick={()=>startEdit(row)}><Pencil size={15}/> Edit</button><button className="ims-delete-btn" disabled={!!busyId} onClick={()=>deleteReport(row)}><Trash2 size={15}/> Delete</button><button className="ims-approve-btn" disabled={!!busyId} onClick={()=>action(row,'pending_rsm','Approve')}><CheckCircle2 size={15}/> Approve</button></div>
          <div className="ims-rollback-row"><label>Rollback-এর কারণ<input value={rollbackReason[row.id] || ''} onChange={e=>setRollbackReason(old=>({...old,[row.id]:e.target.value}))} placeholder="SO-কে কী সংশোধন করতে হবে লিখুন"/></label><button className="ims-rollback-btn" disabled={!!busyId} onClick={()=>action(row,'returned_to_so','Rollback')}><RotateCcw size={15}/> Rollback</button></div>
        </>}
      </section>)}
  </div>;
}
