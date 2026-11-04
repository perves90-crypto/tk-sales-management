import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from './lib/supabase';

const blank={sku_code:'',category:'',product_name:'',product_size:'',pieces_per_carton:'',carton_rate:'',retailer_carton_rate:'',mrp:'',item_weight_kg:''};
const money=n=>'৳'+Number(n||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});

export default function SKUManager({profile,userId}) {
  const isRsm=String(profile?.role||'').toUpperCase()==='RSM';
  const [form,setForm]=useState(blank),[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async()=>{setLoading(true);setError('');const {data,error:e}=await supabase.from('skus').select('id,sku_code,category,product_name,product_size,pieces_per_carton,carton_rate,per_piece_rate,retailer_carton_rate,retailer_per_piece_rate,mrp,item_weight_kg,active').order('category').order('product_name');if(e)setError('SKU লোড হয়নি: '+e.message);else setRows(data||[]);setLoading(false);};
  useEffect(()=>{load();},[]);
  const set=(k,v)=>setForm(o=>({...o,[k]:v}));
  const save=async e=>{e.preventDefault();setError('');setNotice('');if(!isRsm)return setError('শুধু RSM SKU তৈরি/পরিবর্তন করতে পারবেন।');if(Number(form.pieces_per_carton)<=0||Number(form.carton_rate)<0||Number(form.retailer_carton_rate)<0||Number(form.mrp)<0)return setError('কার্টনের পিস ও মূল্য সঠিকভাবে দিন।');setSaving(true);const {error:e2}=await supabase.from('skus').insert({sku_code:form.sku_code.trim()||null,category:form.category.trim(),product_name:form.product_name.trim(),product_size:form.product_size.trim(),pieces_per_carton:Number(form.pieces_per_carton),carton_rate:Number(form.carton_rate),retailer_carton_rate:Number(form.retailer_carton_rate),mrp:Number(form.mrp),item_weight_kg:Number(form.item_weight_kg||0),created_by:userId});setSaving(false);if(e2)setError('SKU সংরক্ষণ হয়নি: '+e2.message);else{setForm(blank);setNotice('SKU যোগ হয়েছে। প্রতি পিসের মূল্য স্বয়ংক্রিয়ভাবে নির্ধারিত হয়েছে।');await load();}};
  const toggle=async x=>{const {error:e}=await supabase.from('skus').update({active:!x.active,updated_at:new Date().toISOString()}).eq('id',x.id);if(e)setError('আপডেট হয়নি: '+e.message);else{setNotice('SKU অবস্থা আপডেট হয়েছে।');await load();}};
  return <div className="sku-manager">
    <div className="notice"><Save size={19}/><div><strong>SKU ও পণ্যের মূল্য তালিকা</strong><p>প্রতি কার্টনে পিস সংখ্যা এবং কার্টন রেট দিলে প্রতি পিসের মূল্য সিস্টেম নিজে হিসাব করবে। শুধু RSM এই তালিকা পরিবর্তন করতে পারবেন।</p></div></div>
    {error&&<div className="admin-alert">{error}</div>}{notice&&<div className="admin-success">{notice}</div>}
    {isRsm&&<section className="admin-panel-card"><h2 className="sku-form-heading">নতুন SKU যোগ করুন</h2><form className="sku-form" onSubmit={save}>
      <label>SKU কোড (ঐচ্ছিক)<input value={form.sku_code} onChange={e=>set('sku_code',e.target.value)} placeholder="যেমন SKU-001"/></label>
      <label>ক্যাটাগরি<input value={form.category} onChange={e=>set('category',e.target.value)} required placeholder="যেমন Biscuit"/></label>
      <label>প্রোডাক্টের নাম<input value={form.product_name} onChange={e=>set('product_name',e.target.value)} required/></label>
      <label>সাইজ<input value={form.product_size} onChange={e=>set('product_size',e.target.value)} required placeholder="যেমন 200 gm"/></label>
      <label>প্রতি কার্টনে পিস<input type="number" min="1" step="1" value={form.pieces_per_carton} onChange={e=>set('pieces_per_carton',e.target.value)} required/></label>
      <label>প্রতি কার্টনের রেট (৳)<input type="number" min="0" step="0.01" value={form.carton_rate} onChange={e=>set('carton_rate',e.target.value)} required/></label>
      <label>দোকানদার ক্রয় মূল্য / কার্টন (৳)<input type="number" min="0" step="0.01" value={form.retailer_carton_rate} onChange={e=>set('retailer_carton_rate',e.target.value)} required/></label>
      <label>MRP / পিস (৳)<input type="number" min="0" step="0.01" value={form.mrp} onChange={e=>set('mrp',e.target.value)} required/></label>
      <label>কার্টনের ওজন (কেজি)<input type="number" min="0" step="0.001" value={form.item_weight_kg} onChange={e=>set('item_weight_kg',e.target.value)}/></label>
      <div className="sku-derived-rate"><small>স্বয়ংক্রিয় প্রতি পিস মূল্য</small><strong>{Number(form.pieces_per_carton)>0?money(Number(form.carton_rate||0)/Number(form.pieces_per_carton)):money(0)}</strong></div>
      <button className="primary-btn" disabled={saving}>{saving?'সেভ হচ্ছে…':'SKU সংরক্ষণ করুন'} <Plus size={16}/></button>
    </form></section>}
    <div className="section-title"><h2>প্রোডাক্ট লিস্ট</h2><button className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button></div>
    <section className="team-list-card">{loading?<p className="area-state">লোড হচ্ছে…</p>:rows.length===0?<p className="area-state">PDF রেট লিস্ট পাওয়ার পর পণ্যগুলো যোগ করা হবে।</p>:rows.map(x=><article className="sku-list-row" key={x.id}><div><strong>{x.product_name}</strong><small>{x.category} · {x.product_size} · {x.pieces_per_carton} পিস/কার্টন</small><small>DP কার্টন: {money(x.carton_rate)} · দোকানদার কার্টন: {money(x.retailer_carton_rate)}</small><small>DP/পিস: {money(x.per_piece_rate)} · দোকানদার/পিস: {money(x.retailer_per_piece_rate)} · MRP: {money(x.mrp)}</small></div><button className="sku-toggle" disabled={!isRsm} onClick={()=>toggle(x)}>{x.active?<><ToggleRight size={19}/> চালু</>:<><ToggleLeft size={19}/> বন্ধ</>}</button></article>)}</section>
  </div>;
}
