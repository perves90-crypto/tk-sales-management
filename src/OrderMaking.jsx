import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ShoppingCart, Save, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabase';

const money = n => '৳' + Number(n || 0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});
const blankQty = () => ({carton_qty:0,dozen_qty:0,piece_qty:0,free_pieces:0});

export default function OrderMaking({ outlet, onBack, profile, userId }) {
  const [skus,setSkus]=useState([]);
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('সব ক্যাটাগরি');
  const [qty,setQty]=useState({});
  const [discount,setDiscount]=useState('0');
  const [paid,setPaid]=useState('0');
  const [notes,setNotes]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [date,setDate]=useState(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'}));

  const load=async()=>{
    setLoading(true);setError('');
    const {data,error:e}=await supabase.from('skus').select('id,sku_code,category,product_name,product_size,pieces_per_carton,retailer_carton_rate,retailer_per_piece_rate').eq('active',true).order('category').order('product_name');
    if(e)setError('SKU লোড হয়নি: '+e.message);else setSkus(data||[]);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const setField=(id,key,value)=>setQty(old=>({...old,[id]:{...blankQty(),...old[id],[key]:Math.max(0,Math.floor(Number(value)||0))}}));
  const lines=useMemo(()=>skus.map(s=>{
    const q={...blankQty(),...qty[s.id]};
    const pieces=q.carton_qty*Number(s.pieces_per_carton)+q.dozen_qty*12+q.piece_qty;
    const rate=Number(s.retailer_per_piece_rate||0);
    return {...s,...q,totalPieces:pieces,lineValue:Math.round(pieces*rate*100)/100};
  }),[skus,qty]);
  const selected=lines.filter(x=>x.totalPieces>0||x.free_pieces>0);
  const categories=[...new Set(skus.map(s=>s.category).filter(Boolean))];
  const visibleLines=lines.filter(s=>(category==='সব ক্যাটাগরি'||s.category===category)&&(`${s.sku_code||''} ${s.product_name} ${s.product_size}`).toLowerCase().includes(search.toLowerCase()));
  const totalPieces=selected.reduce((a,x)=>a+x.totalPieces,0);
  const gross=selected.reduce((a,x)=>a+x.lineValue,0);
  const net=Math.max(0,gross-Math.max(0,Number(discount)||0));
  const balance=net-Math.max(0,Number(paid)||0);
  const submit=async e=>{
    e.preventDefault();setError('');setNotice('');
    if(!userId)return setError('লগইন সেশন পাওয়া যায়নি।');
    if(!selected.length||totalPieces===0)return setError('কমপক্ষে একটি SKU-এর অর্ডার পরিমাণ দিন।');
    if(Number(discount)>gross)return setError('ডিসকাউন্ট মোট অর্ডার মূল্যের বেশি হতে পারবে না।');
    if(Number(paid)>net)return setError('জমার টাকা নেট অর্ডার মূল্যের বেশি হতে পারবে না।');
    const items=selected.map(x=>({sku_id:x.id,carton_qty:x.carton_qty,dozen_qty:x.dozen_qty,piece_qty:x.piece_qty,free_pieces:x.free_pieces}));
    setSaving(true);
    const {data,error:e2}=await supabase.rpc('create_sales_order',{
      p_outlet_id:outlet.id,p_order_date:date,p_discount:Number(discount)||0,
      p_paid:Number(paid)||0,p_notes:notes,p_items:items
    });
    setSaving(false);
    if(e2)setError('অর্ডার সংরক্ষণ হয়নি: '+e2.message);
    else setNotice('অর্ডার সফলভাবে সংরক্ষণ হয়েছে। Order ID: '+data);
  };

  return <div className="order-module">
    <button className="back-link" onClick={onBack}><ArrowLeft size={17}/> আউটলেট লিস্টে ফিরে যান</button>
    <div className="notice"><ShoppingCart size={20}/><div><strong>{outlet.shop_name}</strong><p>{outlet.shopkeeper_name} · {outlet.mobile_number} · {outlet.route_name}</p></div></div>
    {error&&<div className="admin-alert">{error}</div>}{notice&&<div className="admin-success">{notice}</div>}
    <form onSubmit={submit}>
      <section className="admin-panel-card order-summary-card">
        <div className="order-top-fields"><label>অর্ডারের তারিখ<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>আজ জমা টাকা (৳)<input type="number" min="0" step="0.01" value={paid} onChange={e=>setPaid(e.target.value)}/></label></div>
      </section>
      <div className="section-title"><h2>SKU অনুযায়ী অর্ডার</h2><button type="button" className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button></div>
      <section className="admin-panel-card" style={{display:'grid',gridTemplateColumns:'1fr',gap:10,marginBottom:12}}>
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="আইটেম কোড বা পণ্যের নাম লিখে খুঁজুন"/>
        <select value={category} onChange={e=>setCategory(e.target.value)}><option>সব ক্যাটাগরি</option>{categories.map(x=><option key={x}>{x}</option>)}</select>
      </section>
      {loading?<div className="team-list-card"><p className="area-state">SKU লোড হচ্ছে…</p></div>:skus.length===0?<div className="team-list-card"><p className="area-state">এখনো কোনো SKU পাওয়া যায়নি।</p></div>:visibleLines.map(s=><section className="sku-order-card" key={s.id}>
        <div className="sku-order-title"><div><strong>{s.product_name}</strong><small>কোড: {s.sku_code||'—'} · {s.category} · {s.product_size} · কার্টনে {s.pieces_per_carton} পিস</small></div><div className="sku-order-rate"><strong>{money(s.retailer_per_piece_rate)}</strong><small>দোকানদার ক্রয় মূল্য / পিস</small></div></div>
        <div className="sku-qty-grid"><label>কার্টন<input type="number" min="0" step="1" inputMode="numeric" value={s.carton_qty||''} placeholder="0" onChange={e=>setField(s.id,'carton_qty',e.target.value)}/></label><label>ডজন<input type="number" min="0" step="1" inputMode="numeric" value={s.dozen_qty||''} placeholder="0" onChange={e=>setField(s.id,'dozen_qty',e.target.value)}/></label><label>পিস<input type="number" min="0" step="1" inputMode="numeric" value={s.piece_qty||''} placeholder="0" onChange={e=>setField(s.id,'piece_qty',e.target.value)}/></label><label>ফ্রি পিস<input type="number" min="0" step="1" inputMode="numeric" value={s.free_pieces||''} placeholder="0" onChange={e=>setField(s.id,'free_pieces',e.target.value)}/></label></div>
        <div className="sku-line-total"><span>মোট বিক্রয় পিস: <b>{s.totalPieces.toLocaleString('en-BD')}</b>{s.free_pieces>0&&<small> · ফ্রি: {s.free_pieces} পিস</small>}</span><strong>{money(s.lineValue)}</strong></div>
      </section>)}
      <section className="admin-panel-card order-totals">
        <div><span>মোট অর্ডার পিস</span><strong>{totalPieces.toLocaleString('en-BD')}</strong></div>
        <div><span>মোট অর্ডার মূল্য</span><strong>{money(gross)}</strong></div>
        <label>ডিসকাউন্ট (৳)<input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
        <div><span>নেট অর্ডার মূল্য</span><strong>{money(net)}</strong></div>
        <div><span>আজ জমা</span><strong>{money(paid)}</strong></div>
        <div className="balance-total"><span>বাকি</span><strong>{money(balance)}</strong></div>
        <label className="order-notes">নোট (ঐচ্ছিক)<textarea rows="2" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <button className="primary-btn order-submit" disabled={saving||loading||skus.length===0}>{saving?'অর্ডার সেভ হচ্ছে…':'অর্ডার সাবমিট করুন'} <Save size={17}/></button>
      </section>
    </form>
  </div>;
}
