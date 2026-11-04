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

export default function IMSApproveRSM({ profile, userId }) {
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
    if (String(profile?.role || '').toUpperCase() !== 'RSM') {
      setRows([]); setLoading(false); setError('এই প্যানেল শুধু RSM অ্যাকাউন্টের জন্য।'); return;
    }
    const { data, error: queryError } = await supabase.from('sales_reports')
      .select('id,so_id,area_id,report_date,visit_count,productive_visit,order_memo,order_value,ims_memo,ims_value,remarks,status,created_at')
      .eq('status', 'pending_rsm').order('report_date', { ascending: false });
    if (queryError) { setError('RSM-এর Pending IMS রিপোর্ট আনা যায়নি: ' + queryError.message); setRows([]); setLoading(false); return; }
    const reportRows = data || [];
    if (reportRows.length) {
      const ids = [...new Set(reportRows.map(r => r.so_id).filter(Boolean))];
      const dates = [...new Set(reportRows.map(r => r.report_date).filter(Boolean))];
      const { data: returns, error: returnError } = await supabase.from('market_returns')
        .select('so_profile_id,return_date,total_value').in('so_profile_id', ids).in('return_date', dates).eq('status', 'submitted');
      if (returnError) setError(old => [old, 'Market Return সমন্বয় আনা যায়নি: ' + returnError.message].filter(Boolean).join(' | '));
      const returnTotals = {};
      (returns || []).forEach(x => { const key = `${x.so_profile_id}|${x.return_date}`; returnTotals[key] = (returnTotals[key] || 0) + Number(x.total_value || 0); });
      const ids = [...new Set(reportRows.map(r => r.so_id).filter(Boolean))];
      const [{ data: people, error: peopleError }, { data: areas, error: areasError }] = await Promise.all([
        supabase.from('profiles').select('id,employee_id,full_name,role').in('id', ids),
        supabase.from('areas').select('id,name')
      ]);
      if (peopleError) setError('SO-এর নাম আনা যায়নি: ' + peopleError.message);
      if (areasError) setError(old => [old, 'Area-এর নাম আনা যায়নি: ' + areasError.message].filter(Boolean).join(' | '));
      const byId = Object.fromEntries((people || []).map(p => [p.id, p]));
      const areaById = Object.fromEntries((areas || []).map(a => [a.id, a.name]));
      setRows(reportRows.map(r => { const returned = returnTotals[`${r.so_id}|${r.report_date}`] || 0; return { ...r, so: byId[r.so_id] || null, area_name: areaById[r.area_id] || '—', market_return_value: returned, net_ims_value: Math.max(0, Number(r.ims_value || 0) - returned) }; }));
    } else setRows([]);
    setLoading(false);
  }, [profile?.role]);

  useEffect(() => { load(); }, [load]);

  const action = async (row, nextStatus, label) => {
    setError(''); setNotice('');
    const reason = (rollbackReason[row.id] || '').trim();
    if (nextStatus === 'returned_to_asm' && !reason) { setError('Rollback করার আগে ASM-কে সংশোধনের কারণ লিখুন।'); return; }
    if (!window.confirm((row.so?.full_name || row.so?.employee_id || 'SO') + ' — ' + row.report_date + ' রিপোর্টে "' + label + '" করবেন?')) return;
    setBusyId(row.id);
    const patch = { status: nextStatus };
    if (nextStatus === 'approved') {
      const { data } = await supabase.auth.getUser();
      patch.rsm_reviewed_by = data?.user?.id || userId;
      patch.rsm_reviewed_at = new Date().toISOString();
    }
    if (nextStatus === 'returned_to_asm') patch.remarks = [row.remarks, 'RSM Rollback: ' + reason].filter(Boolean).join('\n');
    const { error: updateError } = await supabase.from('sales_reports').update(patch).eq('id', row.id).eq('status', 'pending_rsm');
    setBusyId('');
    if (updateError) setError(label + ' সম্পন্ন হয়নি: ' + updateError.message);
    else { setNotice('রিপোর্টে ' + label + ' সম্পন্ন হয়েছে।'); setRollbackReason(old => ({ ...old, [row.id]: '' })); await load(); }
  };

  const startEdit = row => {
    setEditingId(row.id);
    setEdit({ report_date: row.report_date, visit_count: String(row.visit_count ?? 0), productive_visit: String(row.productive_visit ?? 0), order_memo: String(row.order_memo ?? 0), order_value: String(row.order_value ?? 0), ims_memo: String(row.ims_memo ?? 0), ims_value: String(row.ims_value ?? 0), remarks: row.remarks || '' });
    setError(''); setNotice('');
  };
  const saveEdit = async row => {
    setError(''); setNotice('');
    for (const key of ['visit_count','productive_visit','order_memo','order_value','ims_memo','ims_value']) {
      if (edit[key] === '' || !Number.isFinite(Number(edit[key])) || Number(edit[key]) < 0) { setError('সব সংখ্যার ঘর সঠিকভাবে পূরণ করুন।'); return; }
    }
    if (Number(edit.productive_visit) > Number(edit.visit_count)) { setError('Productive Visit, মোট Visit-এর চেয়ে বেশি হতে পারবে না।'); return; }
    if (Number(edit.order_memo) > Number(edit.productive_visit)) { setError('Order Memo সংখ্যা Productive Visit-এর চেয়ে বেশি।'); return; }
    if (!window.confirm('সংশোধিত রিপোর্ট সংরক্ষণ করবেন?')) return;
    setBusyId(row.id);
    const payload = { report_date: edit.report_date, visit_count: Number(edit.visit_count), productive_visit: Number(edit.productive_visit), order_memo: Number(edit.order_memo), order_value: Number(edit.order_value), ims_memo: Number(edit.ims_memo), ims_value: Number(edit.ims_value), remarks: edit.remarks.trim() || null };
    const { error: saveError } = await supabase.from('sales_reports').update(payload).eq('id', row.id).eq('status', 'pending_rsm');
    setBusyId('');
    if (saveError) setError('Edit সংরক্ষণ হয়নি: ' + saveError.message);
    else { setEditingId(''); setNotice('সংশোধিত রিপোর্ট সংরক্ষণ হয়েছে।'); await load(); }
  };
  const deleteReport = async row => {
    if (!window.confirm((row.so?.full_name || row.so?.employee_id || 'SO') + '-এর ' + row.report_date + ' রিপোর্ট Delete করবেন?')) return;
    setBusyId(row.id); setError(''); setNotice('');
    const { error: deleteError } = await supabase.from('sales_reports').delete().eq('id', row.id).eq('status', 'pending_rsm');
    setBusyId('');
    if (deleteError) setError('Delete হয়নি: ' + deleteError.message);
    else { setNotice('Pending রিপোর্ট Delete করা হয়েছে।'); await load(); }
  };

  if (String(profile?.role || '').toUpperCase() !== 'RSM') return <div className="admin-alert">IMS Approve for RSM শুধু RSM Role-এ ব্যবহার করা যাবে।</div>;
  return <div className="ims-approval-area">
    <div className="notice"><ClipboardCheck size={19}/><div><strong>IMS Approval — RSM Review</strong><p>ASM অনুমোদিত রিপোর্ট যাচাই করুন। Approve করলে রিপোর্ট চূড়ান্তভাবে অনুমোদিত হবে।</p></div></div>
    {error && <div className="admin-alert">{error}</div>}{notice && <div className="admin-success">{notice}</div>}
    <div className="section-title"><h2>RSM-এর জন্য অপেক্ষমাণ রিপোর্ট ({rows.length.toLocaleString('bn-BD')})</h2><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={14}/> রিফ্রেশ</button></div>
    {loading ? <div className="team-list-card"><p className="area-state">IMS রিপোর্ট লোড হচ্ছে…</p></div> : rows.length === 0 ? <div className="team-list-card"><p className="area-state">RSM Approval-এর জন্য কোনো Pending রিপোর্ট নেই।</p></div> :
      rows.map(row => <section className="admin-panel-card ims-report-card" key={row.id}>
        <div className="ims-report-header"><div><h3>{row.so?.full_name || 'SO নাম পাওয়া যায়নি'}</h3><p>Employee ID: {row.so?.employee_id || '—'} · Area: {row.area_name} · তারিখ: {row.report_date}</p></div><span className="ims-pending-badge">Pending RSM</span></div>
        {editingId === row.id ? <div className="ims-edit-grid">{fields.map(([key,label,type]) => <label key={key}>{label}<input type={type} min={type==='number'?'0':undefined} step={type==='number'?(key.includes('value')?'0.01':'1'):undefined} value={edit[key] ?? ''} onChange={e=>setEdit(old=>({...old,[key]:e.target.value}))} required /></label>)}<label className="ims-edit-wide">মন্তব্য<textarea rows="2" value={edit.remarks} onChange={e=>setEdit(old=>({...old,remarks:e.target.value}))}/></label><div className="ims-action-row"><button className="admin-refresh" onClick={()=>setEditingId('')}><X size={15}/> বাতিল</button><button className="primary-btn" disabled={busyId===row.id} onClick={()=>saveEdit(row)}><Save size={15}/> Edit সংরক্ষণ</button></div></div> : <>
          <div className="ims-report-metrics"><span>Market Visit <b>{fmt(row.visit_count)}</b></span><span>Productive Visit <b>{fmt(row.productive_visit)}</b></span><span>Order Memo <b>{fmt(row.order_memo)}</b></span><span>Order Value <b>৳{fmt(row.order_value)}</b></span><span>IMS Memo <b>{fmt(row.ims_memo)}</b></span><span>মূল IMS <b>৳{fmt(row.ims_value)}</b></span><span>Market Return <b>−৳{fmt(row.market_return_value)}</b></span><span>Net IMS <b>৳{fmt(row.net_ims_value ?? row.ims_value)}</b></span></div>
          {row.remarks && <p className="ims-remarks">মন্তব্য: {row.remarks}</p>}
          <div className="ims-action-row"><button className="ims-edit-btn" disabled={!!busyId} onClick={()=>startEdit(row)}><Pencil size={15}/> Edit</button><button className="ims-delete-btn" disabled={!!busyId} onClick={()=>deleteReport(row)}><Trash2 size={15}/> Delete</button><button className="ims-approve-btn" disabled={!!busyId} onClick={()=>action(row,'approved','Approve')}><CheckCircle2 size={15}/> Approve</button></div>
          <div className="ims-rollback-row"><label>Rollback-এর কারণ<input value={rollbackReason[row.id] || ''} onChange={e=>setRollbackReason(old=>({...old,[row.id]:e.target.value}))} placeholder="ASM-কে সংশোধনের কারণ লিখুন"/></label><button className="ims-rollback-btn" disabled={!!busyId} onClick={()=>action(row,'returned_to_asm','Rollback')}><RotateCcw size={15}/> Rollback</button></div>
        </>}
      </section>)}
  </div>;
}
