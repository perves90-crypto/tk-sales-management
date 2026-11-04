import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { Download, FileSpreadsheet, Printer, RefreshCw, Target, TrendingUp, TrendingDown, Users, CalendarDays } from 'lucide-react';

const dhakaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = n => '৳' + Math.round(Number(n || 0)).toLocaleString('bn-BD');
const number = n => Number(n || 0).toLocaleString('bn-BD');
const pct = (a, b) => b ? (Number(a || 0) / Number(b) * 100) : 0;
const monthBounds = month => ({ start: month + '-01', end: new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)).toISOString().slice(0,10) });

function StatCard({ label, value, note, icon: Icon }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18}/></div></div><strong className="stat-value">{value}</strong><small>{note}</small></div>;
}

export default function TargetAchievement({ profile, userId }) {
  const [month, setMonth] = useState(dhakaToday().slice(0,7));
  const [tab, setTab] = useState('overview');
  const [targets, setTargets] = useState([]);
  const [reports, setReports] = useState([]);
  const [people, setPeople] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const role = String(profile?.role || '').toUpperCase();
  const bounds = monthBounds(month);

  const load = async () => {
    setLoading(true); setError('');
    try {
      let targetQuery = supabase.from('targets').select('id,target_date,target_period,employee_id,area_id,order_target,ims_target').gte('target_date', bounds.start).lte('target_date', bounds.end).order('target_date');
      let reportQuery = supabase.from('sales_reports').select('id,so_id,area_id,report_date,visit_count,productive_visit,order_memo,order_value,ims_memo,ims_value,status').gte('report_date', bounds.start).lte('report_date', bounds.end).order('report_date');
      if (role === 'SO') {
        targetQuery = targetQuery.eq('employee_id', userId);
        reportQuery = reportQuery.eq('so_id', userId);
      } else if (role === 'ASM') {
        targetQuery = targetQuery.eq('area_id', profile?.area_id || '00000000-0000-0000-0000-000000000000');
        reportQuery = reportQuery.eq('area_id', profile?.area_id || '00000000-0000-0000-0000-000000000000');
      }
      const [t, r, p, a] = await Promise.all([
        targetQuery, reportQuery,
        supabase.from('profiles').select('id,employee_id,full_name,role,area_id,manager_id').eq('active', true),
        supabase.from('areas').select('id,name').eq('active', true)
      ]);
      if (t.error) throw new Error('Target: ' + t.error.message);
      if (r.error) throw new Error('Sales report: ' + r.error.message);
      if (p.error) throw new Error('Team: ' + p.error.message);
      if (a.error) throw new Error('Area: ' + a.error.message);
      setTargets(t.data || []); setReports(r.data || []); setPeople(p.data || []); setAreas(a.data || []);
    } catch (e) { setError(e.message || 'তথ্য লোড করা যায়নি।'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [month, role, profile?.area_id, userId]);

  const model = useMemo(() => {
    const peopleMap = Object.fromEntries(people.map(p => [p.id, p]));
    const areaMap = Object.fromEntries(areas.map(a => [a.id, a.name]));
    const rows = targets.map(t => {
      const person = t.employee_id ? peopleMap[t.employee_id] : null;
      const areaId = t.area_id || person?.area_id || null;
      const actualRows = reports.filter(r => t.employee_id ? r.so_id === t.employee_id : r.area_id === areaId);
      const orderActual = actualRows.reduce((s,r)=>s+Number(r.order_value||0),0);
      const imsActual = actualRows.reduce((s,r)=>s+Number(r.ims_value||0),0);
      return {
        id:t.id, date:t.target_date, period:t.target_period || '—',
        employee_id:t.employee_id, area_id:areaId,
        name:person?.full_name || (areaId ? areaMap[areaId] : 'Region Target') || '—',
        role:person?.role || (t.employee_id ? '—' : 'Area'),
        area:areaMap[areaId] || 'Region',
        orderTarget:Number(t.order_target||0), imsTarget:Number(t.ims_target||0),
        orderActual, imsActual,
        orderPct:pct(orderActual,t.order_target), imsPct:pct(imsActual,t.ims_target),
        orderGap:orderActual-Number(t.order_target||0), imsGap:imsActual-Number(t.ims_target||0),
        actualRows
      };
    }).filter(r => areaFilter==='all' || r.area_id===areaFilter);
    const summaryRows = rows.filter(r => { const hasEmployeeTargets = rows.some(x => x.area_id === r.area_id && x.employee_id); return hasEmployeeTargets ? !!r.employee_id : true; });
    const total = key => summaryRows.reduce((s,r)=>s+r[key],0);
    const daily = {};
    reports.filter(r=>areaFilter==='all'||r.area_id===areaFilter).forEach(r=>{
      const d=daily[r.report_date] ||= {date:r.report_date,order:0,ims:0,visits:0,productive:0,memos:0,imsMemos:0};
      d.order+=Number(r.order_value||0); d.ims+=Number(r.ims_value||0);
      d.visits+=Number(r.visit_count||0); d.productive+=Number(r.productive_visit||0);
      d.memos+=Number(r.order_memo||0); d.imsMemos+=Number(r.ims_memo||0);
    });
    const ranking = [...rows].sort((a,b)=>b.imsPct-a.imsPct);
    return { rows, summaryRows, daily:Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date)), ranking,
      orderTarget:total('orderTarget'), imsTarget:total('imsTarget'), orderActual:total('orderActual'), imsActual:total('imsActual') };
  }, [targets,reports,people,areas,areaFilter]);

  const exportExcel = () => {
    const summary = [
      ['TK Sales Management - Target Versus Achievement'], ['Month',month], ['Role',role],
      ['Order Target',model.orderTarget], ['Order Achievement',model.orderActual], ['Order Achievement %',pct(model.orderActual,model.orderTarget)],
      ['IMS Target',model.imsTarget], ['IMS Achievement',model.imsActual], ['IMS Achievement %',pct(model.imsActual,model.imsTarget)]
    ];
    const detail = model.rows.map(r=>({Name:r.name,Role:r.role,Area:r.area,Target_Period:r.period,Order_Target:r.orderTarget,Order_Achievement:r.orderActual,Order_Achievement_Percent:r.orderPct,Order_Shortfall_or_Plus:r.orderGap,IMS_Target:r.imsTarget,IMS_Achievement:r.imsActual,IMS_Achievement_Percent:r.imsPct,IMS_Shortfall_or_Plus:r.imsGap}));
    const daily = model.daily.map(d=>({Date:d.date,Order_Value:d.order,IMS_Value:d.ims,Market_Visit:d.visits,Productive_Visit:d.productive,Order_Memo:d.memos,IMS_Memo:d.imsMemos,CPR_Percent:pct(d.productive,d.visits),Strike_Rate_Percent:pct(d.memos,d.productive)}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summary),'Summary');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(detail),'Target vs Achievement');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(daily),'Daily Performance');
    XLSX.writeFile(wb,'TK_Target_Versus_Achievement_'+month+'.xlsx');
  };
  const tabs=[['overview','Overview Dashboard'],['sales','Sales Analysis'],['daily','Date-wise Performance'],['ranking','Area & SO Ranking'],['export','Export Reports']];
  const title = 'Target Versus Achievement';
  return <div className="target-module">
    <div className="notice"><Target size={19}/><div><strong>{title} · {role} Panel</strong><p>আপনার Role ও Supabase RLS অনুযায়ী অনুমোদিত Target এবং Sales Report দেখানো হচ্ছে। Target না থাকলে Achievement-কে Target হিসেবে ধরে নেওয়া হবে না।</p></div></div>
    <div className="target-toolbar"><label><CalendarDays size={16}/> মাস নির্বাচন <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>{role!=='SO'&&<label>Area <select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}><option value="all">সব Area</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}<button className="admin-refresh" onClick={load}><RefreshCw size={14}/> Refresh</button></div>
    <div className="target-tabs">{tabs.map(([key,label])=><button key={key} className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {loading?<div className="team-list-card"><p className="area-state">Target ও Achievement লোড হচ্ছে…</p></div>:error?<div className="admin-alert">তথ্য পাওয়া যায়নি: {error}</div>:<>
      {tab==='overview'&&<><div className="stats-grid"><StatCard label="Order Target" value={money(model.orderTarget)} note="নির্বাচিত মাসের Target" icon={Target}/><StatCard label="Order Achievement" value={money(model.orderActual)} note={pct(model.orderActual,model.orderTarget).toFixed(1)+'% অর্জন'} icon={TrendingUp}/><StatCard label="IMS Target" value={money(model.imsTarget)} note="নির্বাচিত মাসের Target" icon={Target}/><StatCard label="IMS Achievement" value={money(model.imsActual)} note={pct(model.imsActual,model.imsTarget).toFixed(1)+'% অর্জন'} icon={TrendingUp}/><StatCard label="Order Shortfall / Plus" value={money(model.orderActual-model.orderTarget)} note="Achievement − Target" icon={TrendingDown}/><StatCard label="IMS Shortfall / Plus" value={money(model.imsActual-model.imsTarget)} note="Achievement − Target" icon={TrendingDown}/></div>
      <div className="area-list-card"><h3>Target বনাম Achievement</h3>{[['Order',model.orderTarget,model.orderActual],['IMS',model.imsTarget,model.imsActual]].map(([label,target,actual])=><div className="target-progress-row" key={label}><div><strong>{label}</strong><span>{money(actual)} / {money(target)} · {pct(actual,target).toFixed(1)}%</span></div><div className="target-track"><i style={{width:Math.min(100,pct(actual,target))+'%'}}/></div></div>)}</div></>}
      {tab==='sales'&&<div className="area-list-card"><h3>Sales Analysis · Employee / Area</h3><div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Area</th><th>Order Target</th><th>Order Ach.</th><th>Order %</th><th>IMS Target</th><th>IMS Ach.</th><th>IMS %</th></tr></thead><tbody>{model.rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.area}</td><td>{money(r.orderTarget)}</td><td>{money(r.orderActual)}</td><td className={r.orderPct>=100?'positive':'negative'}>{r.orderPct.toFixed(1)}%</td><td>{money(r.imsTarget)}</td><td>{money(r.imsActual)}</td><td className={r.imsPct>=100?'positive':'negative'}>{r.imsPct.toFixed(1)}%</td></tr>)}</tbody></table>{!model.rows.length&&<p className="area-state">এই মাসে Target পাওয়া যায়নি।</p>}</div></div>}
      {tab==='daily'&&<div className="area-list-card"><h3>Date-wise Performance</h3><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Order</th><th>IMS</th><th>Market Visit</th><th>Productive</th><th>Order Memo</th><th>IMS Memo</th><th>CPR</th><th>Strike Rate</th></tr></thead><tbody>{model.daily.map(d=><tr key={d.date}><td>{d.date}</td><td>{money(d.order)}</td><td>{money(d.ims)}</td><td>{number(d.visits)}</td><td>{number(d.productive)}</td><td>{number(d.memos)}</td><td>{number(d.imsMemos)}</td><td>{pct(d.productive,d.visits).toFixed(1)}%</td><td>{pct(d.memos,d.productive).toFixed(1)}%</td></tr>)}</tbody></table>{!model.daily.length&&<p className="area-state">এই মাসে Sales Report নেই।</p>}</div></div>}
      {tab==='ranking'&&<div className="area-list-card"><h3>Area & SO Ranking · IMS Achievement</h3><div className="table-scroll"><table className="data-table"><thead><tr><th>Rank</th><th>Name</th><th>Role</th><th>Area</th><th>IMS Target</th><th>IMS Achievement</th><th>Achievement %</th></tr></thead><tbody>{model.ranking.map((r,i)=><tr key={r.id}><td>{number(i+1)}</td><td>{r.name}</td><td>{r.role}</td><td>{r.area}</td><td>{money(r.imsTarget)}</td><td>{money(r.imsActual)}</td><td className={r.imsPct>=100?'positive':'negative'}>{r.imsPct.toFixed(1)}%</td></tr>)}</tbody></table>{!model.ranking.length&&<p className="area-state">Ranking তৈরির মতো Target পাওয়া যায়নি।</p>}</div></div>}
      {tab==='export'&&<div className="area-list-card export-card"><h3>Report Export · {month}</h3><p>একটি Excel ফাইলে Summary, Target vs Achievement এবং Date-wise Performance আলাদা Sheet-এ থাকবে। PDF-এর জন্য Print ব্যবহার করে “Save as PDF” নির্বাচন করুন।</p><button className="primary-btn" onClick={exportExcel}><FileSpreadsheet size={17}/> Excel Export <Download size={16}/></button><button className="admin-refresh" onClick={()=>window.print()}><Printer size={16}/> PDF / Print</button></div>}
    </>}
  </div>;
}
