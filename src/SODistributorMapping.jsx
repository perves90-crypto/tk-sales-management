import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { Upload, Download, RefreshCw, Search, Users, FileCheck2, AlertTriangle } from 'lucide-react';

const clean = v => String(v ?? '').trim();
const keyOf = v => clean(v).toLowerCase().replace(/[\\s_-]+/g, '');
const pick = (row, names) => {
  const normalized = Object.fromEntries(Object.entries(row).map(([k,v]) => [keyOf(k), v]));
  for (const name of names) if (normalized[keyOf(name)] !== undefined) return clean(normalized[keyOf(name)]);
  return '';
};
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export default function SODistributorMapping({ profile, userId, areas = [] }) {
  const isAdmin = String(profile?.role || '').toUpperCase() === 'RSM';
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState([]);
  const [mappings,setMappings] = useState([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [search,setSearch] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    const {data,error} = await supabase.from('so_distributor_mappings')
      .select('id,so_profile_id,so_employee_id,so_name,area_id,so_point,db_code,db_name,db_point,active,valid_from,valid_to,created_at')
      .order('created_at',{ascending:false});
    if(error) setError('Mapping তালিকা লোড হয়নি: '+error.message);
    else setMappings(data || []);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const areaByName = useMemo(()=>new Map(areas.map(a=>[clean(a.name).toLowerCase(),a])),[areas]);
  const visible = mappings.filter(m => (m.so_employee_id+' '+m.so_name+' '+m.db_code+' '+m.db_name+' '+m.so_point+' '+m.db_point).toLowerCase().includes(search.toLowerCase()));
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Area Name','SO ID','SO Name','SO Point','DB Code','DB Name','DB Point'],
      ['Jashore','3300001','SO Name','Jashore Sadar','DB001','Distributor Name','Jashore Sadar DP']
    ]);
    XLSX.utils.book_append_sheet(wb,ws,'SO Distributor Mapping');
    XLSX.writeFile(wb,'TK_SO_Distributor_Mapping_Template.xlsx');
  };

  const readExcel = async () => {
    setError(''); setNotice(''); setPreview([]);
    if(!isAdmin) return setError('শুধু RSM Admin Excel আপলোড করতে পারবেন।');
    if(!file) return setError('প্রথমে Excel ফাইল নির্বাচন করুন।');
    setBusy(true);
    try {
      const buffer = await new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onerror=()=>reject(new Error('ফাইল পড়া যায়নি। আবার নির্বাচন করুন।'));
        reader.onload=()=>resolve(reader.result);
        reader.readAsArrayBuffer(file);
      });
      const workbook = XLSX.read(buffer,{type:'array'});
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if(!sheet) throw new Error('Excel-এর প্রথম শিট পাওয়া যায়নি।');
      const source = XLSX.utils.sheet_to_json(sheet,{defval:''});
      if(!source.length) throw new Error('Excel ফাইলে কোনো ডেটা নেই।');
      const {data:people,error:peopleError} = await supabase.from('profiles')
        .select('id,employee_id,full_name,role,area_id,active').eq('role','SO').eq('active',true);
      if(peopleError) throw new Error('SO তালিকা আনা যায়নি: '+peopleError.message);
      const parsed = source.map((row,i)=>{
        const areaName=pick(row,['Area Name','Area','এলাকার নাম']);
        const soId=pick(row,['SO ID','SO Employee ID','Employee ID','SO Code','SO আইডি']);
        const soName=pick(row,['SO Name','SO নাম']);
        const soPoint=pick(row,['SO Point','SO পয়েন্ট']);
        const dbCode=pick(row,['DB Code','Distributor Code','ডিবি কোড']);
        const dbName=pick(row,['DB Name','Distributor Name','ডিবি নাম']);
        const dbPoint=pick(row,['DB Point','Distributor Point','ডিবি পয়েন্ট']);
        const area=areaByName.get(areaName.toLowerCase());
        const so=people.find(p=>clean(p.employee_id).toLowerCase()===soId.toLowerCase());
        const issues=[];
        if(!areaName) issues.push('Area Name নেই');
        else if(!area) issues.push('Area মেলেনি');
        if(!soId) issues.push('SO ID নেই');
        else if(!so) issues.push('সক্রিয় SO ID profiles-এ পাওয়া যায়নি');
        if(!soName) issues.push('SO Name নেই');
        if(so && soName && clean(so.full_name).toLowerCase()!==soName.toLowerCase()) issues.push('SO Name profiles-এর নামের সঙ্গে মিলছে না');
        if(!soPoint) issues.push('SO Point নেই');
        if(!dbCode) issues.push('DB Code নেই');
        if(!dbName) issues.push('DB Name নেই');
        if(!dbPoint) issues.push('DB Point নেই');
        if(area && so && so.area_id && so.area_id!==area.id) issues.push('SO-এর Area এবং Excel Area আলাদা');
        return {rowNo:i+2,areaName,areaId:area?.id||'',soProfileId:so?.id||'',soId,soName,soPoint,dbCode,dbName,dbPoint,issues};
      }).filter(r=>r.soId||r.dbCode||r.soName);
      const duplicates = new Set();
      parsed.forEach(r=>{const k=r.soId.toLowerCase(); if(k && duplicates.has(k)) r.issues.push('একই SO ID একাধিকবার আছে'); else if(k) duplicates.add(k);});
      setPreview(parsed);
      if(parsed.some(r=>r.issues.length)) setNotice('Preview তৈরি হয়েছে। লাল চিহ্নিত সারির ভুল ঠিক করে আবার Excel পড়ুন।');
      else setNotice(parsed.length+'টি সারি যাচাই হয়েছে। Import/Update করতে পারবেন।');
    } catch(e) { setError('Excel পড়া হয়নি: '+e.message); }
    finally { setBusy(false); }
  };

  const importRows = async () => {
    setError('');setNotice('');
    if(!isAdmin) return setError('শুধু RSM Admin Import করতে পারবেন।');
    if(!preview.length) return setError('আগে Excel Preview তৈরি করুন।');
    const invalid=preview.find(r=>r.issues.length);
    if(invalid) return setError('Excel সারি '+invalid.rowNo+'-এর ভুল ঠিক করে আবার Preview তৈরি করুন।');
    setBusy(true);
    try {
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user) throw new Error('লগইন সেশন পাওয়া যায়নি। আবার লগইন করুন।');
      let created=0, changed=0, unchanged=0;
      for(const r of preview) {
        const {data:existing,error:readError}=await supabase.from('so_distributor_mappings')
          .select('id,so_profile_id,so_employee_id,so_name,area_id,so_point,db_code,db_name,db_point,active')
          .eq('so_profile_id',r.soProfileId).eq('active',true).maybeSingle();
        if(readError) throw new Error(r.soId+' mapping পড়া যায়নি: '+readError.message);
        const same=existing && existing.so_employee_id===r.soId && existing.so_name===r.soName &&
          existing.area_id===r.areaId && existing.so_point===r.soPoint && existing.db_code===r.dbCode &&
          existing.db_name===r.dbName && existing.db_point===r.dbPoint;
        if(same){unchanged++;continue;}
        if(existing) {
          const {error:closeError}=await supabase.from('so_distributor_mappings')
            .update({active:false,valid_to:today()}).eq('id',existing.id);
          if(closeError) throw new Error(r.soId+' পুরোনো mapping বন্ধ হয়নি: '+closeError.message);
          changed++;
        } else created++;
        const {error:insertError}=await supabase.from('so_distributor_mappings').insert({
          so_profile_id:r.soProfileId,so_employee_id:r.soId,so_name:r.soName,area_id:r.areaId,
          so_point:r.soPoint,db_code:r.dbCode,db_name:r.dbName,db_point:r.dbPoint,
          active:true,valid_from:today(),created_by:user.id
        });
        if(insertError) throw new Error(r.soId+' mapping সংরক্ষণ হয়নি: '+insertError.message);
      }
      setNotice('Import/Update সম্পন্ন: নতুন '+created+', পরিবর্তিত '+changed+', অপরিবর্তিত '+unchanged+'।');
      setPreview([]);setFile(null);await load();
    } catch(e) { setError('Import/Update সম্পূর্ণ হয়নি: '+e.message+'। তালিকা রিফ্রেশ করে যাচাই করুন।'); }
    finally { setBusy(false); }
  };

  return <div className="employee-manager">
    <div className="notice"><Users size={19}/><div><strong>SO–Distributor Mapping</strong><p>একজন SO-এর অধীনে একবারে একজন Active Distributor থাকবে। এখানে আউটলেট নয়, SO-এর সঙ্গে Distributor নির্ধারণ হবে।</p></div></div>
    {!isAdmin && <div className="admin-alert">শুধু RSM Admin mapping আপলোড বা পরিবর্তন করতে পারবেন।</div>}
    {error && <div className="admin-alert">{error}</div>}
    {notice && <div className="admin-success">{notice}</div>}
    <section className="admin-panel-card">
      <div className="admin-card-heading"><div><h2>Excel Upload / Update</h2><p>প্রথম শিটে Area Name, SO ID, SO Name, SO Point, DB Code, DB Name, DB Point কলাম রাখুন।</p></div><Upload/></div>
      <div className="employee-upload-row">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview([]);setError('');setNotice('');}}/>
        <button type="button" className="admin-refresh" onClick={downloadTemplate}><Download size={15}/> Excel Template</button>
        <button type="button" className="primary-btn" disabled={!isAdmin||busy||!file} onClick={readExcel}>{busy?'যাচাই হচ্ছে…':'Preview / যাচাই'} <FileCheck2 size={16}/></button>
      </div>
      <p className="admin-footnote">SO ID অবশ্যই Team/User-এ থাকা সক্রিয় SO-এর Employee ID হতে হবে। SO Name ও Area মিলিয়ে দেখা হবে।</p>
      {preview.length>0 && <>
        <div className="section-title"><h2>Excel Preview</h2><span>{preview.length.toLocaleString('bn-BD')} সারি</span></div>
        {preview.some(r=>r.issues.length)&&<div className="admin-alert"><AlertTriangle size={16}/> কিছু সারিতে ভুল আছে। ভুল না ঠিক করা পর্যন্ত Import হবে না।</div>}
        <div style={{overflowX:'auto'}}><table className="mapping-table"><thead><tr><th>Row</th><th>Area</th><th>SO ID / Name</th><th>SO Point</th><th>DB Code / Name</th><th>DB Point</th><th>Validation</th></tr></thead>
          <tbody>{preview.map(r=><tr key={r.rowNo} className={r.issues.length?'mapping-invalid':''}><td>{r.rowNo}</td><td>{r.areaName||'—'}</td><td>{r.soId||'—'}<br/>{r.soName||'—'}</td><td>{r.soPoint||'—'}</td><td>{r.dbCode||'—'}<br/>{r.dbName||'—'}</td><td>{r.dbPoint||'—'}</td><td>{r.issues.length?r.issues.join(' · '):'ঠিক আছে'}</td></tr>)}</tbody>
        </table></div>
        <button type="button" className="primary-btn" disabled={!isAdmin||busy||preview.some(r=>r.issues.length)} onClick={importRows}>{busy?'সংরক্ষণ হচ্ছে…':'Import / Update করুন'} <Upload size={16}/></button>
      </>}
    </section>
    <section className="admin-panel-card">
      <div className="admin-card-heading"><div><h2>SO–Distributor Mapping তালিকা ও ইতিহাস</h2><p>পরিবর্তন হলে পুরোনো mapping মুছে না গিয়ে Inactive ইতিহাস হিসেবে থাকবে।</p></div><RefreshCw/></div>
      <div className="employee-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SO ID, SO নাম, DB Code বা DB Name দিয়ে খুঁজুন"/></div>
      <div className="team-list-card">{loading?<p className="area-state">তথ্য লোড হচ্ছে…</p>:visible.length===0?<p className="area-state">কোনো mapping পাওয়া যায়নি।</p>:visible.map(m=><div className="team-row" key={m.id}><div className="avatar">{m.active?'✓':'↺'}</div><div className="team-details"><strong>{m.so_name} · {m.db_name}</strong><small>SO ID: {m.so_employee_id} · Area: {areas.find(a=>a.id===m.area_id)?.name||'—'} · SO Point: {m.so_point} · DB: {m.db_code} · DB Point: {m.db_point}</small><small>{m.active?'কার্যকর: '+m.valid_from:'ইতিহাস: '+m.valid_from+' — '+(m.valid_to||'—')}</small></div><span className={m.active?'member-active':'member-inactive'}>{m.active?'Active':'Inactive'}</span></div>)}</div>
      <button type="button" className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button>
    </section>
  </div>;
}
