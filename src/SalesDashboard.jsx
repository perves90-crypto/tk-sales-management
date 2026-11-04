import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import { Activity, BarChart3, CalendarDays, Target, TrendingDown, Users, RefreshCw } from 'lucide-react';

const dhakaDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const money = n => '৳' + Math.round(Number(n || 0)).toLocaleString('bn-BD');
const num = n => Number(n || 0).toLocaleString('bn-BD');
const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);

function Metrics({ title, rows, nonExecutionValue }) {
  const visits = sum(rows, 'visit_count');
  const productive = sum(rows, 'productive_visit');
  const memos = sum(rows, 'order_memo');
  const cpr = visits ? productive / visits * 100 : 0;
  const strike = productive ? memos / productive * 100 : 0;
  const neBase = sum(rows, 'previous_order_value');
  const nePct = neBase ? nonExecutionValue / neBase * 100 : 0;
  const cards = [
    ['IMS Value', money(sum(rows, 'ims_value')), Activity],
    ['Order Value', money(sum(rows, 'order_value')), BarChart3],
    ['Market Visit', num(visits), Users],
    ['Productive Visit', num(productive), Target],
    ['Order Memo', num(memos), CalendarDays],
    ['CPR', cpr.toLocaleString('bn-BD', { maximumFractionDigits: 1 }) + '%', TrendingDown],
    ['Strike Rate', strike.toLocaleString('bn-BD', { maximumFractionDigits: 1 }) + '%', Target],
    ['Non-Execution Value', money(nonExecutionValue), TrendingDown],
    ['Non-Execution %', nePct.toLocaleString('bn-BD', { maximumFractionDigits: 1 }) + '%', Activity],
  ];
  return <section className="dashboard-period">
    <div className="section-title"><h2>{title}</h2><span>{num(rows.length)}টি রিপোর্ট</span></div>
    <div className="stats-grid">{cards.map(([label,value,Icon]) => <div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18}/></div></div><strong className="stat-value">{value}</strong><small>জমা দেওয়া রিপোর্ট অনুযায়ী</small></div>)}</div>
    {!rows.length && <p className="area-state">এই সময়ের কোনো রিপোর্ট পাওয়া যায়নি।</p>}
  </section>;
}

export default function SalesDashboard({ profile, userId }) {
  const [allRows, setAllRows] = useState([]);
  const [people, setPeople] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lookupWarning, setLookupWarning] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const today = dhakaDate();
  const monthStart = today.slice(0, 7) + '-01';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(''); setLookupWarning('');
      try {
        let query = supabase.from('sales_reports')
          .select('id,so_id,area_id,report_date,visit_count,productive_visit,order_memo,order_value,ims_memo,ims_value,status')
          .lte('report_date', today).order('report_date', { ascending: true });
        const role = String(profile?.role || '').toUpperCase();
        if (role === 'SO') query = query.eq('so_id', userId);
        else if (role === 'ASM') query = query.eq('area_id', profile?.area_id || '00000000-0000-0000-0000-000000000000');
        const { data, error: reportError } = await query;
        if (reportError) throw reportError;
        if (!alive) return;
        const [{ data: profileRows, error: profileError }, { data: areaRows, error: areaError }] = await Promise.all([
          supabase.from('profiles').select('id,full_name,employee_id,area_id'),
          supabase.from('areas').select('id,name')
        ]);
        if (!alive) return;
        const areaMap = Object.fromEntries((areaRows || []).map(a => [a.id, a.name]));
        const peopleMap = Object.fromEntries((profileRows || []).map(p => [p.id, { ...p, area_name: areaMap[p.area_id] || '' }]));
        setPeople(peopleMap);
        if (profileError || areaError) setLookupWarning('রিপোর্টের হিসাব পাওয়া গেছে, তবে কিছু কর্মী/এরিয়ার নাম দেখানো যাচ্ছে না।');
        const previous = {};
        const enriched = (data || []).map(row => {
          const prior = previous[row.so_id];
          const nonExec = prior == null ? 0 : Math.max(0, Number(prior) - Number(row.order_value || 0));
          previous[row.so_id] = Number(row.order_value || 0);
          return { ...row, previous_order_value: prior == null ? 0 : Number(prior), non_execution_value: nonExec };
        });
        setAllRows(enriched);
      } catch (e) {
        if (alive) { setError(e?.message || 'রিপোর্ট লোড করা যায়নি।'); setAllRows([]); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [profile?.role, profile?.area_id, userId, today, refreshKey]);

  const todayRows = useMemo(() => allRows.filter(r => r.report_date === today), [allRows, today]);
  const monthRows = useMemo(() => allRows.filter(r => r.report_date >= monthStart && r.report_date <= today), [allRows, monthStart, today]);
  const todayNE = sum(todayRows, 'non_execution_value');
  const monthNE = sum(monthRows, 'non_execution_value');

  return <div className="sales-dashboard">
    {loading ? <div className="team-list-card"><p className="area-state">রিপোর্টের হিসাব লোড হচ্ছে…</p></div> : error ? <div className="admin-alert">রিপোর্ট আনা যায়নি: {error}<button className="admin-refresh" onClick={()=>setRefreshKey(x=>x+1)}><RefreshCw size={14}/> আবার চেষ্টা করুন</button></div> : <>
      <div className="notice"><Activity size={19}/><div><strong>আপনার Role অনুযায়ী রিপোর্ট</strong><p>SO: নিজের রিপোর্ট · ASM: নিজের এরিয়ার রিপোর্ট · RSM: পুরো Jashore Region-এর রিপোর্ট। আজকের এবং চলতি মাসের হিসাব আলাদা দেখানো হচ্ছে।</p></div></div>
      {lookupWarning && <div className="admin-alert">{lookupWarning}</div>}
      <Metrics title="আজকের হিসাব" rows={todayRows} nonExecutionValue={todayNE}/>
      <Metrics title="চলতি মাসের হিসাব" rows={monthRows} nonExecutionValue={monthNE}/>
      <div className="section-title"><h2>সাম্প্রতিক জমা রিপোর্ট</h2><span>সর্বশেষ ১০টি</span></div>
      <div className="area-list-card">
        {!allRows.length ? <p className="area-state">এখনো কোনো রিপোর্ট পাওয়া যায়নি।</p> : [...allRows].sort((a,b)=>b.report_date.localeCompare(a.report_date)).slice(0,10).map(row => <div className="report-row" key={row.id}>
          <div><strong>{people[row.so_id]?.full_name || people[row.so_id]?.employee_id || 'কর্মী'}</strong><small>{people[row.so_id]?.area_name || ''} · {row.report_date}</small></div>
          <div className="report-row-values"><strong>{money(row.order_value)}</strong><small>IMS {money(row.ims_value)}</small></div>
          <span className="report-status">{row.status || 'submitted'}</span>
        </div>)}
      </div>
    </>}
  </div>;
}
