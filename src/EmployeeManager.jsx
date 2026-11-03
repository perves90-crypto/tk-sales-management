import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { UserPlus, Upload, Download, RefreshCw, Search, ShieldCheck } from 'lucide-react';

const clean = value => String(value ?? '').trim();
const keyOf = value => clean(value).toLowerCase().replace(/[\\s_\\-]+/g, '');
const pick = (row, keys) => {
  const entries = Object.entries(row).reduce((a,[k,v]) => (a[keyOf(k)] = v, a), {});
  for (const key of keys) if (entries[keyOf(key)] !== undefined) return clean(entries[keyOf(key)]);
  return '';
};

export default function EmployeeManager({ isAdmin, areas = [] }) {
  const [rows,setRows] = useState([]);
  const [name,setName] = useState('');
  const [employeeId,setEmployeeId] = useState('');
  const [password,setPassword] = useState('');
  const [role,setRole] = useState('SO');
  const [areaId,setAreaId] = useState('');
  const [file,setFile] = useState(null);
  const [search,setSearch] = useState('');
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const load = async () => {
    setLoading(true);
    const {data,error} = await supabase.from('profiles').select('id,employee_id,full_name,role,area_id,active').order('full_name');
    if(error) setError('কর্মী তালিকা আনা যায়নি: '+error.message);
    else setRows(data || []);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const areaName = id => areas.find(a=>a.id===id)?.name || '—';
  const visibleRows = useMemo(()=>rows.filter(r=>(clean(r.full_name)+' '+clean(r.employee_id)+' '+clean(r.role)).toLowerCase().includes(search.toLowerCase())),[rows,search]);

  const invokeCreate = async employees => {
    const {data,error} = await supabase.functions.invoke('admin-create-employees',{body:{employees}});
    if(error) throw new Error(error.message || 'Backend Function call failed');
    if(data?.error) throw new Error(data.error);
    return data;
  };
  const addOne = async e => {
    e.preventDefault(); setError(''); setMessage('');
    if(!isAdmin) return setError('শুধু RSM কর্মী তৈরি করতে পারবেন।');
    if(!employeeId.trim() || !name.trim() || password.length < 8) return setError('Employee ID, নাম এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।');
    setBusy(true);
    try {
      const result=await invokeCreate([{employee_id:employeeId.trim(),full_name:name.trim(),password,role,area_id:areaId||null}]);
      setMessage(result.message || 'কর্মীর অ্যাকাউন্ট তৈরি হয়েছে।');
      setName('');setEmployeeId('');setPassword('');setRole('SO');setAreaId('');
      await load();
    } catch(err) { setError('কর্মী তৈরি হয়নি: '+err.message); }
    finally { setBusy(false); }
  };
  const uploadExcel = async () => {
    setError('');setMessage('');
    if(!isAdmin) return setError('শুধু RSM Excel আপলোড করতে পারবেন।');
    if(!file) return setError('প্রথমে Excel ফাইল নির্বাচন করুন।');
    setBusy(true);
    try {
      const buffer=await file.arrayBuffer();
      const workbook=XLSX.read(buffer,{type:'array'});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      const source=XLSX.utils.sheet_to_json(sheet,{defval:''});
      const employees=source.map(row=>{
        const empArea=pick(row,['area','area_name','এলাকা','এরিয়া']);
        const matchedArea=areas.find(a=>a.name.toLowerCase()===empArea.toLowerCase());
        return {
          employee_id:pick(row,['employee_id','employee id','id','কর্মী আইডি','আইডি']),
          full_name:pick(row,['full_name','full name','name','কর্মীর নাম','নাম']),
          password:pick(row,['password','পাসওয়ার্ড']),
          role:pick(row,['role','পদবি']).toUpperCase(),
          area_id:matchedArea?.id || null,
          _areaText:empArea
        };
      }).filter(r=>r.employee_id||r.full_name);
      if(!employees.length) throw new Error('Excel-এর প্রথম শিটে কোনো কর্মী পাওয়া যায়নি।');
      const invalid=employees.find(r=>!r.employee_id||!r.full_name||r.password.length<8||!['ASM','SO'].includes(r.role)||(r._areaText&&!r.area_id));
      if(invalid) throw new Error('Excel-এ ID, নাম, ASM/SO Role, কমপক্ষে ৮ অক্ষরের Password এবং সঠিক Area Name দিন।');
      employees.forEach(r=>delete r._areaText);
      const result=await invokeCreate(employees);
      setMessage(result.message || 'Excel কর্মী আপলোড প্রক্রিয়া সম্পন্ন।');
      if(result.results?.length) setMessage((result.message||'আপলোড সম্পন্ন।')+' '+result.results.map(x=>x.employee_id+': '+x.status).join(' | '));
      setFile(null);
      await load();
    } catch(err) { setError('Excel আপলোড হয়নি: '+err.message); }
    finally { setBusy(false); }
  };
  const downloadTemplate = () => {
    const ws=XLSX.utils.aoa_to_sheet([['employee_id','full_name','password','role','area'],['3300001','কর্মীর নাম','ChangeMe123','SO','Jashore'],['3300002','ASM নাম','ChangeMe123','ASM','Jhenaidah']]);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Employees');XLSX.writeFile(wb,'TK_Employee_Upload_Template.xlsx');
  };

  return <div className="employee-manager">
    <div className="notice"><ShieldCheck size={19}/><div><strong>কর্মী অ্যাকাউন্ট ব্যবস্থাপনা</strong><p>RSM এখান থেকে Employee ID ও Password দিয়ে ASM/SO অ্যাকাউন্ট তৈরি করতে পারবেন। Password নিরাপদভাবে Supabase Auth-এ রাখা হবে।</p></div></div>
    {!isAdmin && <div className="admin-alert">শুধু RSM Admin কর্মী তৈরি ও Excel আপলোড করতে পারবেন।</div>}
    {error && <div className="admin-alert">{error}</div>}{message && <div className="admin-success">{message}</div>}
    <section className="admin-panel-card">
      <div className="admin-card-heading"><div><h2>ম্যানুয়ালি নতুন কর্মী তৈরি</h2><p>Employee ID হবে কর্মীর লগইন ID।</p></div><UserPlus/></div>
      <form className="employee-form" onSubmit={addOne}>
        <label>Employee ID<input value={employeeId} onChange={e=>setEmployeeId(e.target.value)} placeholder="যেমন: 3308329" required/></label>
        <label>কর্মীর নাম<input value={name} onChange={e=>setName(e.target.value)} placeholder="পূর্ণ নাম" required/></label>
        <label>পাসওয়ার্ড<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="কমপক্ষে ৮ অক্ষর" required/></label>
        <label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="SO">SO</option><option value="ASM">ASM</option></select></label>
        <label>Area<select value={areaId} onChange={e=>setAreaId(e.target.value)}><option value="">Area নির্বাচন করুন</option>{areas.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <button className="primary-btn" disabled={!isAdmin||busy}>{busy?'তৈরি হচ্ছে…':'কর্মী তৈরি করুন'} <UserPlus size={16}/></button>
      </form>
    </section>
    <section className="admin-panel-card">
      <div className="admin-card-heading"><div><h2>Excel দিয়ে একসঙ্গে কর্মী আপলোড</h2><p>প্রথম শিটে employee_id, full_name, password, role, area কলাম রাখুন। Role হবে ASM অথবা SO।</p></div><Upload/></div>
      <div className="employee-upload-row"><input type="file" accept=".xlsx,.xls,.csv" onChange={e=>setFile(e.target.files?.[0]||null)}/><button type="button" className="admin-refresh" onClick={downloadTemplate}><Download size={15}/> Excel Template</button><button type="button" className="primary-btn" disabled={!isAdmin||busy||!file} onClick={uploadExcel}>{busy?'আপলোড হচ্ছে…':'Excel Upload'} <Upload size={16}/></button></div>
      <p className="admin-footnote">Password Excel ফাইল থেকে শুধু অ্যাকাউন্ট তৈরির সময় ব্যবহার হবে; profiles টেবিলে সংরক্ষণ করা হবে না। ফাইলটি নিরাপদে রাখুন এবং আপলোডের পর মুছে ফেলুন।</p>
    </section>
    <div className="section-title"><h2>কর্মী তালিকা</h2><div className="employee-list-tools"><span>{rows.length.toLocaleString('bn-BD')} জন</span><button className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button></div></div>
    <div className="employee-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="নাম, Employee ID বা Role দিয়ে খুঁজুন"/></div>
    <div className="team-list-card">{loading?<p className="area-state">কর্মীদের তথ্য লোড হচ্ছে…</p>:visibleRows.length===0?<p className="area-state">কোনো কর্মী পাওয়া যায়নি।</p>:visibleRows.map(member=><div className="team-row" key={member.id}><div className="avatar">{(member.full_name||'U').slice(0,1)}</div><div className="team-details"><strong>{member.full_name||'নাম দেওয়া হয়নি'}</strong><small>ID: {member.employee_id||'—'} · {member.role||'—'} · {areaName(member.area_id)}</small></div><span className={member.active?'member-active':'member-inactive'}>{member.active?'সক্রিয়':'নিষ্ক্রিয়'}</span></div>)}</div>
  </div>;
}
