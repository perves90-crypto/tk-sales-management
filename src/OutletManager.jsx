import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Store, MapPin, Phone, UserRound } from 'lucide-react';
import { supabase } from './lib/supabase';

const emptyForm = { shop_name: '', shopkeeper_name: '', mobile_number: '', route_name: '', cluster_name: '', shop_address: '', area_id: '' };

export default function OutletManager({ profile, areas = [], userId }) {
  const role = String(profile?.role || '').toUpperCase();
  const isRsm = role === 'RSM';
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    let query = supabase.from('outlets').select('id,shop_name,shopkeeper_name,mobile_number,route_name,cluster_name,shop_address,area_id,created_by,created_at,active').eq('active', true).order('shop_name');
    if (role === 'SO') query = query.eq('created_by', userId);
    if (role === 'ASM' && profile?.area_id) query = query.eq('area_id', profile.area_id);
    const { data, error: e } = await query;
    if (e) setError('আউটলেট লোড হয়নি: ' + e.message);
    else setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { if (profile && userId) load(); }, [profile?.role, profile?.area_id, userId]);

  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const submit = async e => {
    e.preventDefault(); setError(''); setNotice('');
    if (!userId) return setError('লগইন সেশন পাওয়া যায়নি।');
    const areaId = isRsm ? form.area_id : profile?.area_id;
    if (!areaId) return setError('এই আউটলেটের Area নির্বাচন/প্রোফাইলে সেট করা নেই।');
    setSaving(true);
    const { error: e2 } = await supabase.from('outlets').insert({
      shop_name: form.shop_name.trim(), shopkeeper_name: form.shopkeeper_name.trim(),
      mobile_number: form.mobile_number.trim(), route_name: form.route_name.trim(),
      cluster_name: form.cluster_name.trim(), shop_address: form.shop_address.trim(),
      area_id: areaId, created_by: userId
    });
    setSaving(false);
    if (e2) setError('সংরক্ষণ হয়নি: ' + e2.message + ' · outlets টেবিল ও RLS SQL চালানো হয়েছে কি না দেখুন।');
    else { setForm({ ...emptyForm, area_id: isRsm ? form.area_id : '' }); setNotice('আউটলেট সফলভাবে সংরক্ষণ হয়েছে।'); await load(); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(x => [x.shop_name,x.shopkeeper_name,x.mobile_number,x.route_name,x.cluster_name,x.shop_address].some(v => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  return <div className="outlet-module">
    <div className="notice"><Store size={19}/><div><strong>নতুন আউটলেট যোগ করুন</strong><p>দোকানের প্রয়োজনীয় ৬টি তথ্য দিয়ে সেভ করুন। পরে অর্ডার মেকিংয়ে এই দোকান নির্বাচন করা যাবে।</p></div></div>
    {error && <div className="admin-alert">{error}</div>}{notice && <div className="admin-success">{notice}</div>}
    <section className="admin-panel-card">
      <form className="outlet-form" onSubmit={submit}>
        {isRsm && <label>Area<select value={form.area_id} onChange={e=>set('area_id',e.target.value)} required><option value="">Area নির্বাচন করুন</option>{areas.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        <label>দোকানের নাম<input value={form.shop_name} onChange={e=>set('shop_name',e.target.value)} required placeholder="দোকানের নাম"/></label>
        <label>দোকানদারের নাম<input value={form.shopkeeper_name} onChange={e=>set('shopkeeper_name',e.target.value)} required placeholder="দোকানদারের নাম"/></label>
        <label>মোবাইল নম্বর<input type="tel" inputMode="tel" value={form.mobile_number} onChange={e=>set('mobile_number',e.target.value)} required placeholder="01XXXXXXXXX"/></label>
        <label>রুটের নাম<input value={form.route_name} onChange={e=>set('route_name',e.target.value)} required placeholder="রুটের নাম"/></label>
        <label>ক্লাস্টারের নাম<input value={form.cluster_name} onChange={e=>set('cluster_name',e.target.value)} required placeholder="ক্লাস্টারের নাম"/></label>
        <label className="outlet-wide">দোকানের ঠিকানা<textarea value={form.shop_address} onChange={e=>set('shop_address',e.target.value)} required rows="2" placeholder="দোকানের ঠিকানা"/></label>
        <button className="primary-btn outlet-wide" disabled={saving}>{saving?'সেভ হচ্ছে…':'আউটলেট সেভ করুন'} <Plus size={17}/></button>
      </form>
    </section>
    <div className="section-title"><h2>আউটলেট লিস্ট</h2><button className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button></div>
    <div className="employee-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="দোকান, মোবাইল, রুট বা ক্লাস্টার দিয়ে খুঁজুন"/></div>
    <section className="team-list-card">
      {loading ? <p className="area-state">লোড হচ্ছে…</p> : filtered.length === 0 ? <p className="area-state">কোনো আউটলেট পাওয়া যায়নি।</p> : filtered.map(x=><article className="outlet-row" key={x.id}>
        <div className="outlet-icon"><Store size={19}/></div><div className="outlet-copy"><strong>{x.shop_name}</strong><small><UserRound size={12}/> {x.shopkeeper_name}　<Phone size={12}/> {x.mobile_number}</small><small><MapPin size={12}/> {x.route_name} · {x.cluster_name}</small><small>{x.shop_address}</small></div>
      </article>)}
      <p className="outlet-count">মোট আউটলেট: {filtered.length.toLocaleString('bn-BD')}</p>
    </section>
  </div>;
}
