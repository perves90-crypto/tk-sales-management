import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, ArrowLeft, Store, Package, Filter } from 'lucide-react';
import { supabase } from './lib/supabase';

const money = n => '৳' + Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const dateText = value => value ? new Date(value + (String(value).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }) : '—';

export default function OrderSummary({ profile, userId, areas = [] }) {
  const role = String(profile?.role || '').toUpperCase();
  const isRsm = role === 'RSM';
  const isAsm = role === 'ASM';
  const [orders, setOrders] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [items, setItems] = useState([]);
  const [skus, setSkus] = useState([]);
  const [people, setPeople] = useState([]);
  const [areaFilter, setAreaFilter] = useState(isAsm ? (profile?.area_id || '') : '');
  const [routeFilter, setRouteFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const [returnDate, setReturnDate] = useState(today);
  const [returnQty, setReturnQty] = useState({});
  const [returnReason, setReturnReason] = useState({});
  const [returnCondition, setReturnCondition] = useState({});
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnNotice, setReturnNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [orderRes, outletRes, skuRes, profileRes] = await Promise.all([
        supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('outlets').select('id,shop_name,shopkeeper_name,mobile_number,route_name,cluster_name,shop_address,area_id,created_by'),
        supabase.from('skus').select('id,sku_code,product_name,product_size,category,pieces_per_carton,retailer_per_piece_rate,mrp'),
        supabase.from('profiles').select('id,employee_id,full_name,role,area_id')
      ]);
      if (orderRes.error) throw orderRes.error;
      if (outletRes.error) throw outletRes.error;
      if (skuRes.error) throw skuRes.error;
      setOutlets(outletRes.data || []);
      setSkus(skuRes.data || []);
      setPeople(profileRes.data || []);
      let fetchedOrders = (orderRes.data || []).filter(o => String(o.status || 'submitted').toLowerCase() !== 'cancelled');
      if (role === 'SO') fetchedOrders = fetchedOrders.filter(o => o.created_by === userId);
      if (role === 'ASM' && profile?.area_id) fetchedOrders = fetchedOrders.filter(o => o.area_id === profile.area_id);
      setOrders(fetchedOrders);
      const ids = fetchedOrders.map(o => o.id).filter(Boolean);
      if (ids.length) {
        const { data, error: itemError } = await supabase.from('sales_order_items').select('*').in('order_id', ids);
        if (itemError) throw itemError;
        setItems(data || []);
      } else setItems([]);
    } catch (e) {
      setError('অর্ডার সামারি লোড হয়নি: ' + (e?.message || 'অজানা সমস্যা'));
    } finally { setLoading(false); }
  };

  useEffect(() => { if (profile && userId) load(); }, [profile?.role, profile?.area_id, userId]);

  const outletById = useMemo(() => Object.fromEntries(outlets.map(x => [x.id, x])), [outlets]);
  const skuById = useMemo(() => Object.fromEntries(skus.map(x => [x.id, x])), [skus]);
  const personById = useMemo(() => Object.fromEntries(people.map(x => [x.id, x])), [people]);
  const visibleOrders = useMemo(() => orders.filter(o => {
    const outlet = outletById[o.outlet_id] || {};
    const orderArea = o.area_id || outlet.area_id;
    if (areaFilter && orderArea !== areaFilter) return false;
    if (routeFilter && outlet.route_name !== routeFilter) return false;
    const day = String(o.order_date || o.created_at || '').slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    const q = search.trim().toLowerCase();
    if (q && ![outlet.shop_name, outlet.shopkeeper_name, outlet.route_name, o.order_number, personById[o.created_by]?.full_name, personById[o.created_by]?.employee_id].some(v => String(v || '').toLowerCase().includes(q))) return false;
    return true;
  }), [orders, outletById, areaFilter, routeFilter, dateFrom, dateTo, search, personById]);

  const visibleIds = useMemo(() => new Set(visibleOrders.map(o => o.id)), [visibleOrders]);
  const visibleItems = useMemo(() => items.filter(i => visibleIds.has(i.order_id)), [items, visibleIds]);
  const orderTotals = useMemo(() => visibleOrders.reduce((a, o) => {
    a.value += Number(o.net_value || 0);
    a.gross += Number(o.gross_value || 0);
    a.discount += Number(o.discount_amount || 0);
    a.paid += Number(o.paid_amount || 0);
    a.balance += Number(o.balance_amount || 0);
    return a;
  }, { value: 0, gross: 0, discount: 0, paid: 0, balance: 0 }), [visibleOrders]);
  const skuSummary = useMemo(() => {
    const map = new Map();
    visibleItems.forEach(i => {
      const sku = skuById[i.sku_id] || {};
      const id = i.sku_id || sku.sku_code || i.id;
      const row = map.get(id) || { id, code: sku.sku_code || i.sku_code || '—', name: sku.product_name || i.product_name || 'SKU', size: sku.product_size || i.product_size || '', cartons: 0, dozens: 0, pieces: 0, free: 0, value: 0 };
      row.cartons += Number(i.carton_qty || 0);
      row.dozens += Number(i.dozen_qty || 0);
      row.pieces += Number(i.piece_qty || 0);
      row.free += Number(i.free_pieces || 0);
      const perPiece = Number(i.retailer_per_piece_rate || i.per_piece_rate || sku.retailer_per_piece_rate || 0);
      const pack = Number(sku.pieces_per_carton || 0);
      row.value += (Number(i.carton_qty || 0) * pack + Number(i.dozen_qty || 0) * 12 + Number(i.piece_qty || 0)) * perPiece;
      map.set(id, row);
    });
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [visibleItems, skuById]);
  const selectedItems = selected ? items.filter(i => i.order_id === selected.id) : [];
  const selectedOutlet = selected ? (outletById[selected.outlet_id] || {}) : {};
  const selectedRetail = selectedItems.reduce((sum, i) => {
    const sku = skuById[i.sku_id] || {};
    const count = Number(i.carton_qty || 0) * Number(i.pieces_per_carton || sku.pieces_per_carton || 0) + Number(i.dozen_qty || 0) * 12 + Number(i.piece_qty || 0);
    return sum + (count + Number(i.free_pieces || 0)) * Number(i.mrp || sku.mrp || 0);
  }, 0);
  const selectedProfit = selectedRetail - Number(selected?.net_value || 0);
  const selectedProfitPercent = Number(selected?.net_value || 0) > 0 ? selectedProfit / Number(selected.net_value) * 100 : 0;
  const routes = [...new Set(outlets.filter(o => !areaFilter || o.area_id === areaFilter).filter(o => role !== 'SO' || o.created_by === userId).map(o => o.route_name).filter(Boolean))].sort();
  const returnOrderIds = useMemo(() => new Set(orders.filter(o =>
    role === 'SO' && o.created_by === userId &&
    String(o.order_date || o.created_at || '').slice(0, 10) === returnDate &&
    String(o.status || 'submitted').toLowerCase() !== 'cancelled'
  ).map(o => o.id)), [orders, role, userId, returnDate]);
  const returnSkuRows = useMemo(() => {
    const map = new Map();
    items.filter(i => returnOrderIds.has(i.order_id)).forEach(i => {
      const sku = skuById[i.sku_id] || {};
      const id = i.sku_id;
      if (!id) return;
      const row = map.get(id) || { id, code: sku.sku_code || '—', name: sku.product_name || i.product_name || 'SKU', size: sku.product_size || i.product_size || '', ordered: 0, rate: Number(i.retailer_per_piece_rate || i.per_piece_rate || sku.retailer_per_piece_rate || 0) };
      row.ordered += Number(i.total_pieces || 0) + Number(i.free_pieces || 0);
      map.set(id, row);
    });
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [items, returnOrderIds, skuById]);
  const returnTotalPieces = returnSkuRows.reduce((sum, s) => sum + Number(returnQty[s.id] || 0), 0);
  const returnTotalValue = returnSkuRows.reduce((sum, s) => sum + Number(returnQty[s.id] || 0) * s.rate, 0);
  const submitMarketReturn = async e => {
    e.preventDefault(); setError(''); setReturnNotice('');
    const selectedReturns = returnSkuRows.filter(s => Number(returnQty[s.id] || 0) > 0);
    if (!selectedReturns.length) { setError('কমপক্ষে একটি অর্ডারকৃত SKU-এর ফেরত পিস লিখুন।'); return; }
    if (!returnDate) { setError('ফেরতের তারিখ নির্বাচন করুন।'); return; }
    for (const s of selectedReturns) {
      if (!returnReason[s.id]) { setError(s.name + ' পণ্যের ফেরতের কারণ নির্বাচন করুন।'); return; }
      if (!returnCondition[s.id]) { setError(s.name + ' পণ্যের অবস্থা নির্বাচন করুন।'); return; }
    }
    setReturnBusy(true);
    const { data, error: rpcError } = await supabase.rpc('submit_market_return', {
      p_return_date: returnDate,
      p_notes: 'Order Summary থেকে Market Return',
      p_items: selectedReturns.map(s => ({
        sku_id: s.id,
        quantity_pieces: Number(returnQty[s.id]),
        return_reason: returnReason[s.id],
        product_condition: returnCondition[s.id]
      }))
    });
    setReturnBusy(false);
    if (rpcError) setError('Market Return Submit হয়নি: ' + rpcError.message);
    else {
      setReturnNotice('Market Return সফলভাবে জমা হয়েছে। রিটার্ন আইডি: ' + data + '। ভালো পণ্য বিক্রয়যোগ্য স্টকে এবং ড্যামেজ/মেয়াদোত্তীর্ণ পণ্য আলাদা স্টকে যোগ হয়েছে।');
      setReturnQty({}); setReturnReason({}); setReturnCondition({});
    }
  };

  if (selected) return <div className="order-summary-module">
    <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={17}/> অর্ডার লিস্টে ফিরে যান</button>
    <section className="admin-panel-card order-detail-head"><div><span className="eyebrow">অর্ডার বিস্তারিত</span><h2>{selectedOutlet.shop_name || 'দোকান'}</h2><p>{selectedOutlet.shopkeeper_name || ''} · {selectedOutlet.route_name || 'রুট নেই'} · অর্ডার নং: {selected.order_number || selected.id}</p><small>তারিখ: {dateText(selected.order_date || selected.created_at)}</small></div><span className="status-chip">{selected.status || 'Submitted'}</span></section>
    <section className="admin-panel-card"><h3>SKU অনুযায়ী অর্ডার</h3><div className="table-responsive"><table className="permission-table"><thead><tr><th>SKU</th><th>কার্টন</th><th>ডজন</th><th>পিস</th><th>ফ্রি</th><th>লাইন মূল্য</th></tr></thead><tbody>{selectedItems.map(i=>{const s=skuById[i.sku_id]||{};const pieces=Number(i.carton_qty||0)*Number(i.pieces_per_carton||s.pieces_per_carton||0)+Number(i.dozen_qty||0)*12+Number(i.piece_qty||0);const value=Number(i.line_value || (pieces*Number(i.retailer_per_piece_rate||i.per_piece_rate||s.retailer_per_piece_rate||0)));return <tr key={i.id}><td>{i.product_name||s.product_name||s.sku_code||i.sku_id}<small className="table-sub">{s.sku_code||''} {i.product_size||s.product_size||''}</small></td><td>{Number(i.carton_qty||0)}</td><td>{Number(i.dozen_qty||0)}</td><td>{Number(i.piece_qty||0)}</td><td>{Number(i.free_pieces||0)}</td><td>{money(value)}</td></tr>})}</tbody></table></div></section>
    <section className="admin-panel-card order-detail-totals"><div><span>মোট অর্ডার মূল্য</span><strong>{money(selected.gross_value)}</strong></div><div><span>ডিসকাউন্ট</span><strong>{money(selected.discount_amount)}</strong></div><div><span>নেট অর্ডার মূল্য</span><strong>{money(selected.net_value)}</strong></div><div><span>MRP অনুযায়ী বিক্রয় মূল্য</span><strong>{money(selectedRetail)}</strong></div><div className="shopkeeper-profit-highlight"><span className="shopkeeper-profit-label">দোকানদারের সম্ভাব্য লাভ</span><strong className="shopkeeper-profit-amount">{money(selectedProfit)}</strong><span className="shopkeeper-profit-percent">নেট ক্রয়মূল্যের ওপর লাভ: {pct(selectedProfitPercent)}</span></div><div><span>জমা</span><strong>{money(selected.paid_amount)}</strong></div><div><span>বাকি</span><strong>{money(selected.balance_amount)}</strong></div></section>
  </div>;

  return <div className="order-summary-module">
    <div className="notice"><Package size={19}/><div><strong>{role === 'SO' ? 'SO অর্ডার সামারি' : role === 'ASM' ? 'ASM অর্ডার সামারি' : 'RSM অর্ডার সামারি'}</strong><p>দোকানভিত্তিক সাবমিট করা অর্ডার, অর্ডার ভ্যালু, দোকানদারের লাভ এবং SKU ভিত্তিক সারাংশ।</p></div></div>
    {error && <div className="admin-alert">{error}</div>}
    <section className="admin-panel-card order-filter-card"><div className="order-filter-heading"><h3><Filter size={17}/> ফিল্টার</h3><button className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button></div><div className="order-summary-filters">
      {(isRsm || isAsm) && <label>এরিয়া<select value={areaFilter} onChange={e=>{setAreaFilter(e.target.value);setRouteFilter('')}} disabled={isAsm}><option value="">সব এরিয়া</option>{areas.filter(a=>a.active !== false).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      <label>রুট<select value={routeFilter} onChange={e=>setRouteFilter(e.target.value)}><option value="">সব রুট</option>{routes.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
      <label>শুরুর তারিখ<input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>শেষ তারিখ<input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label>
      <label className="order-search-field">দোকান / SO / অর্ডার খুঁজুন<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="দোকানের নাম বা অর্ডার নম্বর"/></label>
    </div></section>
    <div className="order-summary-stats"><div><span>মোট অর্ডার</span><strong>{visibleOrders.length.toLocaleString('bn-BD')}</strong></div><div><span>মোট নেট ভ্যালু</span><strong>{money(orderTotals.value)}</strong></div><div><span>মোট ডিসকাউন্ট</span><strong>{money(orderTotals.discount)}</strong></div><div><span>মোট বাকি</span><strong>{money(orderTotals.balance)}</strong></div></div>
    <section className="admin-panel-card"><div className="section-title"><h3>দোকানভিত্তিক অর্ডার লিস্ট</h3></div>{loading?<p className="area-state">অর্ডার লোড হচ্ছে…</p>:visibleOrders.length===0?<p className="area-state">এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।</p>:<div className="table-responsive"><table className="permission-table order-summary-table"><thead><tr><th>তারিখ</th><th>দোকানের নাম</th><th>রুট</th><th>SO</th><th>অর্ডার ভ্যালু</th><th>দেখুন</th></tr></thead><tbody>{visibleOrders.map(o=>{const outlet=outletById[o.outlet_id]||{};const person=personById[o.created_by]||{};return <tr key={o.id}><td>{dateText(o.order_date||o.created_at)}</td><td><strong>{outlet.shop_name||'দোকান'}</strong><small className="table-sub">{outlet.shopkeeper_name||''}</small></td><td>{outlet.route_name||'—'}</td><td>{person.full_name||person.employee_id||'—'}</td><td><strong>{money(o.net_value)}</strong></td><td><button className="admin-refresh" onClick={()=>setSelected(o)}><Eye size={15}/> View</button></td></tr>})}</tbody></table></div>}</section>
    <section className="admin-panel-card"><div className="section-title"><h3>মোট SKU ভিত্তিক অর্ডার সামারি</h3><span className="muted">{skuSummary.length} SKU</span></div>{skuSummary.length===0?<p className="area-state">SKU অর্ডার ডেটা নেই।</p>:<div className="table-responsive"><table className="permission-table"><thead><tr><th>SKU কোড</th><th>পণ্যের নাম</th><th>কার্টন</th><th>ডজন</th><th>পিস</th><th>ফ্রি পিস</th><th>আনুমানিক ভ্যালু</th></tr></thead><tbody>{skuSummary.map(s=><tr key={s.id}><td>{s.code}</td><td>{s.name}<small className="table-sub">{s.size}</small></td><td>{s.cartons.toLocaleString('en-BD')}</td><td>{s.dozens.toLocaleString('en-BD')}</td><td>{s.pieces.toLocaleString('en-BD')}</td><td>{s.free.toLocaleString('en-BD')}</td><td>{money(s.value)}</td></tr>)}</tbody></table></div>}</section>

    {role === 'SO' && <form onSubmit={submitMarketReturn}>
      <div className="section-title"><h2>অর্ডার সামারি থেকে Market Return Entry</h2></div>
      <section className="admin-panel-card">
        <div className="notice"><Package size={18}/><div><strong>শুধু নির্বাচিত দিনের অর্ডার সামারিতে থাকা SKU ফেরত দেওয়া যাবে</strong><p>ভালো পণ্য বিক্রয়যোগ্য DB Stock-এ; ড্যামেজ ও মেয়াদোত্তীর্ণ পণ্য আলাদা Non-Saleable Stock-এ জমা হবে।</p></div></div>
        <label>অর্ডারের তারিখ / ফেরতের তারিখ<input type="date" value={returnDate} onChange={e=>{setReturnDate(e.target.value);setReturnQty({});setReturnReason({});setReturnCondition({});}} required/></label>
      </section>
      {returnNotice && <div className="admin-success">{returnNotice}</div>}
      {returnSkuRows.length === 0 ? <section className="admin-panel-card"><p className="area-state">এই তারিখে আপনার কোনো সাবমিট করা অর্ডার পাওয়া যায়নি। অর্ডার থাকলে সেই তারিখের SKU এখানে আসবে।</p></section> :
      returnSkuRows.map(s => <section className="sku-order-card" key={s.id}>
        <div className="sku-order-title"><div><strong>{s.name}</strong><small>{s.code} · {s.size} · অর্ডার হয়েছে {s.ordered.toLocaleString('en-BD')} পিস</small></div><div className="sku-order-rate"><strong>{money(s.rate)}</strong><small>প্রতি পিস</small></div></div>
        <div className="order-top-fields">
          <label>ফেরত পরিমাণ (পিস)<input type="number" min="0" step="1" inputMode="numeric" value={returnQty[s.id] || ''} onChange={e=>setReturnQty(v=>({...v,[s.id]:Math.max(0,Math.floor(Number(e.target.value)||0))}))} placeholder="0"/></label>
          <label>ফেরতের কারণ<select value={returnReason[s.id] || ''} onChange={e=>setReturnReason(v=>({...v,[s.id]:e.target.value}))}><option value="">কারণ নির্বাচন</option><option value="unsold">বিক্রি না হওয়া পণ্য</option><option value="damaged">ড্যামেজ পণ্য</option><option value="expired">মেয়াদোত্তীর্ণ</option><option value="packaging">প্যাকেট সমস্যা</option><option value="wrong_supply">ভুল পণ্য সরবরাহ</option><option value="other">অন্যান্য</option></select></label>
          <label>পণ্যের অবস্থা<select value={returnCondition[s.id] || ''} onChange={e=>setReturnCondition(v=>({...v,[s.id]:e.target.value}))}><option value="">অবস্থা নির্বাচন</option><option value="saleable">ভালো / বিক্রয়যোগ্য</option><option value="damaged">ড্যামেজ / বিক্রয় অযোগ্য</option><option value="expired">মেয়াদোত্তীর্ণ / বিক্রয় অযোগ্য</option></select></label>
        </div>
      </section>)}
      <section className="admin-panel-card order-totals"><div><span>মোট ফেরত পিস</span><strong>{returnTotalPieces.toLocaleString('en-BD')}</strong></div><div><span>মোট রিটার্ন মূল্য</span><strong>{money(returnTotalValue)}</strong></div><div><span>IMS / Secondary থেকে সমন্বয়</span><strong>{money(returnTotalValue)}</strong></div><button className="primary-btn order-submit" type="submit" disabled={returnBusy || !returnTotalPieces || !returnSkuRows.length}>{returnBusy ? 'Submit হচ্ছে…' : 'Market Return Submit করুন'} <Save size={17}/></button></section>
    </form>}
    <p className="admin-footnote">SO নিজের অর্ডার, ASM নিজের Area, এবং RSM সব Area-র অর্ডার দেখবেন। ডেটাবেজের RLS নীতিমালাও একইভাবে সীমাবদ্ধ থাকতে হবে।</p>
  </div>;
}
