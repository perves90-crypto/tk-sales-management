import React,{useEffect,useMemo,useState} from 'react';
import {Package,RefreshCw,RotateCcw,Save,Warehouse} from 'lucide-react';
import {supabase} from './lib/supabase';
const money=n=>'৳'+Number(n||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function DBStockReturn({profile,userId}){
 const role=String(profile?.role||'').toUpperCase(),isRsm=role==='RSM',isAsm=role==='ASM',isSo=role==='SO';
 const [mappings,setMappings]=useState([]),[selectedDb,setSelectedDb]=useState(''),[skus,setSkus]=useState([]),[stock,setStock]=useState([]),[qty,setQty]=useState({}),[returns,setReturns]=useState([]),[date,setDate]=useState(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})),[notes,setNotes]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  const [m,s,r,h]=await Promise.all([
   supabase.from('so_distributor_mappings').select('id,so_profile_id,so_employee_id,so_name,area_id,db_code,db_name,db_point,active').eq('active',true),
   supabase.from('skus').select('id,sku_code,product_name,product_size,category,pieces_per_carton,retailer_per_piece_rate,per_piece_rate,active').eq('active',true).order('category').order('product_name'),
   supabase.from('db_stock_summary').select('*'),
   supabase.from('market_returns').select('id,return_number,return_date,db_code,db_name,total_pieces,total_value,so_profile_id,created_at').order('created_at',{ascending:false}).limit(100)
  ]);
  const failed=[m,s,r,h].find(x=>x.error);
  if(failed)setError('স্টক/রিটার্ন ডেটা লোড হয়নি: '+failed.error.message);
  const mine=(m.data||[]).filter(x=>isSo?x.so_profile_id===userId:isAsm?x.area_id===profile?.area_id:true);
  setMappings(mine);setSkus(s.data||[]);setStock(r.data||[]);setReturns(h.data||[]);
  if(!selectedDb&&mine.length)setSelectedDb(isSo?mine[0].db_code:'');
  setLoading(false);
 };
 useEffect(()=>{if(profile&&userId)load();},[profile?.role,profile?.area_id,userId]);
 const dbs=useMemo(()=>mappings.filter(x=>!selectedDb||x.db_code===selectedDb),[mappings,selectedDb]);
 const currentMap=dbs.length===1?dbs[0]:mappings.find(x=>x.db_code===selectedDb);
 const stockBySku=useMemo(()=>{const out={};stock.filter(x=>!selectedDb||x.db_code===selectedDb).forEach(x=>out[x.sku_id]=Number(x.stock_pieces||0));return out;},[stock,selectedDb]);
 const rows=skus.map(s=>({...s,stockPieces:stockBySku[s.id]||0}));
 const setQuantity=(id,value)=>setQty(v=>({...v,[id]:Math.max(0,Math.floor(Number(value)||0))}));
 const selected=skus.filter(s=>Number(qty[s.id]||0)>0);
 const totalPieces=selected.reduce((a,s)=>a+Number(qty[s.id]),0);
 const totalValue=selected.reduce((a,s)=>a+Number(qty[s.id])*Number(s.retailer_per_piece_rate||s.per_piece_rate||0),0);
 const submit=async e=>{
  e.preventDefault();setError('');setNotice('');
  if(!currentMap)return setError('একটি DB নির্বাচন করুন।');
  if(!selected.length)return setError('কমপক্ষে একটি SKU-এর ফেরত পিস লিখুন।');
  for(const s of selected)if(Number(qty[s.id])>Number(stockBySku[s.id]||0))return setError(s.product_name+' ফেরত পরিমাণ বর্তমান DB Stock-এর বেশি।');
  setSaving(true);
  const {data,error:e2}=await supabase.rpc('submit_market_return',{p_return_date:date,p_notes:notes,p_items:selected.map(s=>({sku_id:s.id,quantity_pieces:Number(qty[s.id])}))});
  setSaving(false);
  if(e2)setError('Market Return Submit হয়নি: '+e2.message);
  else{setNotice('Market Return সফলভাবে Submit হয়েছে। রিটার্ন নং: '+data+'। DB Stock আপডেট হয়েছে; একই তারিখের IMS Approval-এ Net IMS সমন্বয় দেখাবে।');setQty({});setNotes('');await load();}
 };
 const visibleReturns=returns.filter(x=>!selectedDb||x.db_code===selectedDb);
 return <div className="order-summary-module">
  <div className="notice"><Warehouse size={20}/><div><strong>DB Stock & Market Return</strong><p>Opening + Receipt + Market Return − Secondary Sales = Closing Stock</p></div></div>
  {error&&<div className="admin-alert">{error}</div>}{notice&&<div className="admin-success">{notice}</div>}
  <section className="admin-panel-card order-filter-card"><div className="order-filter-heading"><h3>ডিস্ট্রিবিউটার নির্বাচন</h3><button className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button></div>
   {isSo?<div className="notice"><Package size={18}/><div><strong>{mappings[0]?.db_name||'DB Mapping পাওয়া যায়নি'}</strong><p>{mappings[0]?.db_code||'RSM Panel থেকে SO–Distributor Mapping করতে হবে'} · {mappings[0]?.db_point||''}</p></div></div>:<label>DB নির্বাচন করুন<select value={selectedDb} onChange={e=>setSelectedDb(e.target.value)}><option value="">সব DB</option>{mappings.map(m=><option key={m.id} value={m.db_code}>{m.db_name} ({m.db_code}) · {m.db_point}</option>)}</select></label>}
  </section>
  <div className="section-title"><h2>বর্তমান DB Stock (SKU অনুযায়ী)</h2></div>
  {loading?<div className="team-list-card"><p className="area-state">স্টক লোড হচ্ছে…</p></div>:<section className="admin-panel-card"><div className="table-responsive"><table className="permission-table"><thead><tr><th>SKU</th><th>পণ্য</th><th>কার্টন</th><th>মোট পিস</th><th>স্টক মূল্য</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td>{s.sku_code||'—'}</td><td>{s.product_name}<small className="table-sub">{s.product_size}</small></td><td>{(s.stockPieces/Number(s.pieces_per_carton||1)).toLocaleString('en-BD',{maximumFractionDigits:2})}</td><td><strong>{s.stockPieces.toLocaleString('en-BD')}</strong></td><td>{money(s.stockPieces*Number(s.retailer_per_piece_rate||s.per_piece_rate||0))}</td></tr>)}</tbody></table></div></section>}
  {isSo&&<form onSubmit={submit}><div className="section-title"><h2>Market Return Entry</h2></div><section className="admin-panel-card"><div className="order-top-fields"><label>ফেরতের তারিখ<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>DB Point<input value={currentMap?.db_point||''} readOnly/></label></div></section>
   {rows.map(s=><section className="sku-order-card" key={s.id}><div className="sku-order-title"><div><strong>{s.product_name}</strong><small>{s.sku_code||''} · {s.product_size} · বর্তমান স্টক: {s.stockPieces} পিস</small></div><div className="sku-order-rate"><strong>{money(s.retailer_per_piece_rate||s.per_piece_rate)}</strong><small>প্রতি পিস মূল্য</small></div></div><label>বাজার থেকে ফেরত (পিস)<input type="number" min="0" max={s.stockPieces} step="1" inputMode="numeric" value={qty[s.id]||''} placeholder="0" onChange={e=>setQuantity(s.id,e.target.value)}/></label></section>)}
   <section className="admin-panel-card order-totals"><div><span>মোট ফেরত পিস</span><strong>{totalPieces.toLocaleString('en-BD')}</strong></div><div><span>Secondary/IMS থেকে বাদ যাবে</span><strong>{money(totalValue)}</strong></div><label className="order-notes">মন্তব্য / ফেরতের কারণ<textarea rows="2" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="ঐচ্ছিক"/></label><button className="primary-btn order-submit" disabled={saving||loading||!totalPieces}>{saving?'Submit হচ্ছে…':'Market Return Submit করুন'} <Save size={17}/></button></section>
  </form>}
  {!isSo&&<p className="admin-footnote">ASM ও RSM এখানে DB Stock এবং Market Return history দেখতে পারবেন। Market Return Entry SO Panel থেকে Submit হবে।</p>}
  <div className="section-title"><h2><RotateCcw size={18}/> Market Return History</h2></div><section className="admin-panel-card">{visibleReturns.length===0?<p className="area-state">কোনো Market Return পাওয়া যায়নি।</p>:<div className="table-responsive"><table className="permission-table"><thead><tr><th>তারিখ</th><th>DB</th><th>রিটার্ন নং</th><th>পিস</th><th>মূল্য</th></tr></thead><tbody>{visibleReturns.map(r=><tr key={r.id}><td>{r.return_date}</td><td>{r.db_name} ({r.db_code})</td><td>{r.return_number}</td><td>{Number(r.total_pieces).toLocaleString('en-BD')}</td><td>{money(r.total_value)}</td></tr>)}</tbody></table></div>}</section>
 </div>;
}