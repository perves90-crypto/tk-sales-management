import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './lib/supabase';
import EmployeeManager from './EmployeeManager';
import DailySalesReport from './DailySalesReport';
import IMSApproveASM from './IMSApproveASM';
import IMSApproveRSM from './IMSApproveRSM';
import SalesDashboard from './SalesDashboard';
import TargetAchievement from './TargetAchievement';
import OutletManager from './OutletManager';
import SKUManager from './SKUManager';
import SODistributorMapping from './SODistributorMapping';
import OrderSummary from './OrderSummary';
import DBStockReturn from './DBStockReturn';
import {
  Activity, ArrowDownToLine, BarChart3, Boxes, CalendarDays, CheckCircle2,
  ChevronRight, ClipboardList, Gauge, LogOut, MapPinned, Menu, Package,
  Settings, ShieldCheck, ShoppingCart, Target, Users, X, Plus, Trash2, RefreshCw
} from 'lucide-react';

const navItems = [
  { label: 'ড্যাশবোর্ড', icon: Gauge },
  { label: 'দৈনিক সেলস রিপোর্ট', icon: BarChart3 },
  { label: 'অর্ডার এন্ট্রি', icon: ShoppingCart },
  { label: 'অর্ডার সামারি', icon: ClipboardList },
  { label: 'DB Stock & Return', icon: Package },
  { label: 'মার্কেট ভিজিট', icon: MapPinned },
  { label: 'টার্গেট ও অ্যাচিভমেন্ট', icon: Target },
  { label: 'টিম / ইউজার', icon: Users },
  { label: 'স্টক ও SKU', icon: Boxes },
  { label: 'রিপোর্টস', icon: ClipboardList },
  { label: 'সেটিংস', icon: Settings },
];

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!supabaseConfigured) {
      setError('Supabase সংযোগের সেটিং এখনো দেওয়া হয়নি। Cloudflare Pages-এর Environment Variables-এ VITE_SUPABASE_URL ও VITE_SUPABASE_PUBLISHABLE_KEY যোগ করুন।');
      return;
    }
    setBusy(true);
    const loginEmail = email.trim().includes('@') ? email.trim() : email.trim() + '@login.tk-sales.internal';
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setBusy(false);
    if (loginError) setError('লগইন হয়নি: ইমেইল/পাসওয়ার্ড যাচাই করুন অথবা Supabase Auth সেটিং দেখুন।');
    else onLogin(data.session);
  };
  return <main className="login-wrap">
    <section className="login-card">
      <div className="brand-mark">T.K</div>
      <p className="eyebrow">T.K FOOD PRODUCTS DISTRIBUTION LIMITED</p>
      <h1>TK Sales Management</h1>
      <p className="muted">Pusti Consumer Division · Sales Force Portal</p>
      <div className="secure-note"><ShieldCheck size={18}/> নিরাপদ কর্মী লগইন</div>
      <form onSubmit={submit}>
        <label>Employee ID / Gmail</label>
        <input type="text" autoComplete="username" placeholder="Employee ID অথবা নিবন্ধিত Gmail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <label>পাসওয়ার্ড</label>
        <input type="password" autoComplete="current-password" placeholder="পাসওয়ার্ড লিখুন" value={password} onChange={e=>setPassword(e.target.value)} required />
        {error && <div className="error-box">{error}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'লগইন হচ্ছে…' : 'লগইন করুন'} <ChevronRight size={18}/></button>
      </form>
      <p className="footnote">শুধু অনুমোদিত কর্মীদের জন্য। আপনার পাসওয়ার্ড কারও সঙ্গে শেয়ার করবেন না।</p>
    </section>
  </main>;
}


function AdminPanel({ isAdmin }) {
  const [menus,setMenus]=useState([]);
  const [permissions,setPermissions]=useState([]);
  const [roles,setRoles]=useState([]);
  const [label,setLabel]=useState('');
  const [key,setKey]=useState('');
  const [parentKey,setParentKey]=useState('daily-sales');
  const parentMenus=[{key:'daily-sales',label:'দৈনিক সেলস রিপোর্ট'},{key:'order-entry',label:'অর্ডার এন্ট্রি'},{key:'market-visit',label:'মার্কেট ভিজিট'},{key:'target-achievement',label:'টার্গেট ও অ্যাচিভমেন্ট'},{key:'team-users',label:'টিম / ইউজার'},{key:'stock-sku',label:'স্টক ও SKU'},{key:'reports',label:'রিপোর্টস'}];
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=async()=>{
    setLoading(true);setError('');
    const [m,p,r]=await Promise.all([
      supabase.from('menu_definitions').select('id,menu_key,label,enabled,sort_order,parent_menu_key').order('sort_order'),
      supabase.from('menu_permissions').select('menu_id,role,can_view,can_edit,can_delete,can_approve'),
      supabase.from('profiles').select('role')
    ]);
    if(m.error)setError('Menu: '+m.error.message);else setMenus(m.data||[]);
    if(p.error)setError(old=>[old,'Permission: '+p.error.message].filter(Boolean).join(' | '));else setPermissions(p.data||[]);
    if(r.error)setError(old=>[old,'Role: '+r.error.message].filter(Boolean).join(' | '));else setRoles([...new Set((r.data||[]).map(x=>x.role).filter(Boolean).map(String))]);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const add=async e=>{
    e.preventDefault();setError('');setNotice('');
    if(!isAdmin)return setError('শুধু RSM Admin এই কাজ করতে পারবেন।');
    const menuKey=key.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-');
    if(!label.trim()||!menuKey)return setError('মডিউলের নাম ও Key দিন।');
    setBusy(true);
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user){setBusy(false);setError('লগইন সেশন পাওয়া যায়নি। আবার লগইন করুন।');return;}
    const {data,error}=await supabase.from('menu_definitions').insert({menu_key:menuKey,label:label.trim(),parent_menu_key:parentKey,enabled:true,sort_order:menus.filter(x=>x.parent_menu_key===parentKey).length+1,created_by:user.id}).select('id,menu_key,label,enabled,sort_order,parent_menu_key').single();
    setBusy(false);
    if(error)setError('সংরক্ষণ হয়নি। Supabase RLS INSERT policy প্রয়োজন: '+error.message);
    else{setMenus(old=>[...old,data]);setLabel('');setKey('');setNotice('মডিউল যোগ হয়েছে।');}
  };
  const toggle=async menu=>{
    const {error}=await supabase.from('menu_definitions').update({enabled:!menu.enabled}).eq('id',menu.id);
    if(error)setError('আপডেট হয়নি। RLS UPDATE policy প্রয়োজন: '+error.message);
    else{setMenus(old=>old.map(x=>x.id===menu.id?{...x,enabled:!x.enabled}:x));setNotice('মডিউল আপডেট হয়েছে।');}
  };
  const remove=async menu=>{
    if(!window.confirm(menu.label+' মুছে ফেলবেন?'))return;
    const {error}=await supabase.from('menu_definitions').delete().eq('id',menu.id);
    if(error)setError('মুছতে পারেনি। Permission row বা RLS DELETE policy পরীক্ষা করুন: '+error.message);
    else{setMenus(old=>old.filter(x=>x.id!==menu.id));setPermissions(old=>old.filter(x=>x.menu_id!==menu.id));setNotice('মডিউল মুছে ফেলা হয়েছে।');}
  };
  const setPermission=async(menuId,role,field,value)=>{
    const old=permissions.find(x=>x.menu_id===menuId&&String(x.role)===role);
    const row={menu_id:menuId,role,can_view:old?.can_view??false,can_edit:old?.can_edit??false,can_delete:old?.can_delete??false,can_approve:old?.can_approve??false,[field]:value};
    const {data,error}=await supabase.from('menu_permissions').upsert(row,{onConflict:'menu_id,role'}).select('menu_id,role,can_view,can_edit,can_delete,can_approve').single();
    if(error)setError('Permission সংরক্ষণ হয়নি। RLS INSERT/UPDATE policy এবং menu_id+role unique constraint প্রয়োজন: '+error.message);
    else{setPermissions(list=>[...list.filter(x=>!(x.menu_id===menuId&&String(x.role)===role)),data]);setNotice('Permission সংরক্ষণ হয়েছে।');}
  };
  return <div className="admin-area">
    <div className="notice"><ShieldCheck size={19}/><div><strong>Admin Panel · মডিউল ও Role Permission</strong><p>মডিউল যোগ, চালু/বন্ধ এবং Role অনুযায়ী View, Edit, Delete ও Approve Access নিয়ন্ত্রণ করুন।</p></div></div>
    {!isAdmin&&<div className="admin-alert">শুধু RSM Role এই Admin Panel পরিচালনা করতে পারবে।</div>}
    {error&&<div className="admin-alert">{error}</div>}{notice&&<div className="admin-success">{notice}</div>}
    <section className="admin-panel-card"><div className="admin-card-heading"><div><h2>মেনুর ভিতরে নতুন অপশন তৈরি করুন</h2><p>প্রথমে কোন মেনুর ভিতরে অপশনটি থাকবে সেটি নির্বাচন করুন।</p></div><Plus/></div>
      <form className="admin-create-form" onSubmit={add}><label>যে মেনুর ভিতরে যোগ হবে<select value={parentKey} onChange={e=>setParentKey(e.target.value)}>{parentMenus.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select></label><label>নতুন অপশনের নাম<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="যেমন: দৈনিক অর্ডার সারাংশ" required/></label><label>অপশন Key<input value={key} onChange={e=>setKey(e.target.value)} placeholder="যেমন: daily-order-summary" required/></label><button className="primary-btn" disabled={!isAdmin||busy}>{busy?'সংরক্ষণ হচ্ছে…':'অপশন যোগ করুন'} <Plus size={16}/></button></form>
    </section>
    <div className="section-title"><h2>তৈরি করা অপশনসমূহ</h2><button className="admin-refresh" onClick={load}><RefreshCw size={14}/> রিফ্রেশ</button></div>
    {loading?<div className="team-list-card"><p className="area-state">লোড হচ্ছে…</p></div>:menus.length===0?<div className="team-list-card"><p className="area-state">menu_definitions টেবিলে কোনো মডিউল নেই।</p></div>:menus.map(menu=><section className="admin-panel-card" key={menu.id}>
      <div className="admin-menu-head"><div><strong>{menu.label}</strong><small>{parentMenus.find(x=>x.key===menu.parent_menu_key)?.label || 'অজানা মেনু'} · {menu.menu_key} · Sort: {menu.sort_order}</small></div><div className="admin-menu-actions"><span className={menu.enabled?'member-active':'member-inactive'}>{menu.enabled?'চালু':'বন্ধ'}</span><button disabled={!isAdmin} onClick={()=>toggle(menu)}>{menu.enabled?'বন্ধ করুন':'চালু করুন'}</button><button className="admin-delete" disabled={!isAdmin} onClick={()=>remove(menu)}><Trash2 size={15}/></button></div></div>
      <div className="permission-table-wrap"><table className="permission-table"><thead><tr><th>Role</th><th>View</th><th>Edit</th><th>Delete</th><th>Approve</th></tr></thead><tbody>{roles.map(role=>{const p=permissions.find(x=>x.menu_id===menu.id&&String(x.role)===role);return <tr key={role}><td>{role}</td>{['can_view','can_edit','can_delete','can_approve'].map(field=><td key={field}><input type="checkbox" disabled={!isAdmin} checked={!!p?.[field]} onChange={e=>setPermission(menu.id,role,field,e.target.checked)}/></td>)}</tr>})}</tbody></table></div>
    </section>)}
    <p className="admin-footnote">Supabase RLS-এ INSERT, UPDATE ও DELETE অনুমতি না থাকলে পরিবর্তন সংরক্ষিত হবে না। বিদ্যমান নিরাপত্তা নীতি বাইপাস করা হচ্ছে না।</p>
  </div>;
}

function AppShell({ session }) {
  const [active, setActive] = useState('ড্যাশবোর্ড');
  const [mobileNav, setMobileNav] = useState(false);
  const [userEmail, setUserEmail] = useState(session?.user?.email || '');
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasError, setAreasError] = useState('');
  const [profile, setProfile] = useState(null);
  const [pendingRsmCount, setPendingRsmCount] = useState(0);
  const [configuredMenus,setConfiguredMenus]=useState([]);
  const [team, setTeam] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  useEffect(() => {
    let mounted = true;
    const loadDashboardData = async () => {
      if (!supabase || !session?.user?.id) { if (mounted) setAreasLoading(false); return; }
      setAreasLoading(true);
      const [areaResult, profileResult] = await Promise.all([
        supabase.from('areas').select('id,name,active').order('name', { ascending: true }),
        supabase.from('profiles').select('full_name,employee_id,role,area_id').eq('id', session.user.id).maybeSingle()
      ]);
      if (!mounted) return;
      if (areaResult.error) setAreasError(areaResult.error.message);
      else setAreas(areaResult.data || []);
      if (!profileResult.error) setProfile(profileResult.data);
      setAreasLoading(false);
    };
    loadDashboardData();
    supabase.from('menu_definitions').select('id,menu_key,label,enabled,sort_order,parent_menu_key').eq('enabled',true).order('sort_order').then(({data})=>{if(mounted)setConfiguredMenus(data||[]);});
    supabase.from('sales_reports').select('id', { count: 'exact', head: true }).eq('status','pending_rsm').then(({count})=>{if(mounted)setPendingRsmCount(count||0);});
    return () => { mounted = false; };
  }, [session?.user?.id]);
  useEffect(() => {
    if (active !== 'টিম / ইউজার' || !supabase) return;
    let mounted = true;
    setTeamLoading(true);
    supabase.from('profiles').select('id,employee_id,full_name,role,area_id,active').order('full_name', { ascending: true })
      .then(({data,error}) => {
        if (!mounted) return;
        if (error) setTeamError(error.message);
        else { setTeam(data || []); setTeamError(''); }
        setTeamLoading(false);
      });
    return () => { mounted = false; };
  }, [active]);
  useEffect(() => {
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setUserEmail(nextSession?.user?.email || ''));
    return () => listener.subscription.unsubscribe();
  }, []);
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); };
  return <div className="app-layout">
    {mobileNav && <button className="scrim" aria-label="মেনু বন্ধ করুন" onClick={()=>setMobileNav(false)} />}
    <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
      <div className="sidebar-brand"><div className="brand-small">T.K</div><div><strong>TK Sales</strong><small>Management Portal</small></div><button className="close-nav" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="region-pill"><span className="live-dot"></span> Jashore Region</div>
      <p className="nav-caption">MAIN MENU</p>
      <nav>{navItems.map(item => {const Icon=item.icon; const parent=({ 'দৈনিক সেলস রিপোর্ট':'daily-sales','অর্ডার এন্ট্রি':'order-entry','অর্ডার সামারি':'order-summary','DB Stock & Return':'db-stock-return','মার্কেট ভিজিট':'market-visit','টার্গেট ও অ্যাচিভমেন্ট':'target-achievement','টিম / ইউজার':'team-users','স্টক ও SKU':'stock-sku','রিপোর্টস':'reports'})[item.label]; const children=configuredMenus.filter(x=>x.parent_menu_key===parent); return <div className="nav-group" key={item.label}><button className={'nav-item '+(active===item.label?'active':'')} onClick={()=>{setActive(item.label);setMobileNav(false)}}><Icon size={18}/><span>{item.label}</span>{active===item.label&&<span className="nav-indicator"/>}</button>{children.map(child=><button key={child.id} className={'nav-subitem '+(active===child.label?'active':'')} onClick={()=>{setActive(child.label);setMobileNav(false)}}><span className="nav-subdot"/><span>{child.label}</span></button>)}{item.label==='দৈনিক সেলস রিপোর্ট' && String(profile?.role || '').toUpperCase()==='ASM' && <button className={'nav-subitem '+(active==='IMS Approve for ASM'?'active':'')} onClick={()=>{setActive('IMS Approve for ASM');setMobileNav(false)}}><span className="nav-subdot"/><span>IMS Approve for ASM</span></button>}{item.label==='দৈনিক সেলস রিপোর্ট' && String(profile?.role || '').toUpperCase()==='RSM' && <button className={'nav-subitem '+(active==='IMS Approve for RSM'?'active':'')} onClick={()=>{setActive('IMS Approve for RSM');setMobileNav(false)}}><span className="nav-subdot"/><span>IMS Approval for RSM ({pendingRsmCount.toLocaleString('bn-BD')})</span></button>}{item.label==='রিপোর্টস' && String(profile?.role || '').toUpperCase()==='RSM' && <button className={'nav-subitem '+(active==='SO–Distributor Mapping'?'active':'')} onClick={()=>{setActive('SO–Distributor Mapping');setMobileNav(false)}}><span className="nav-subdot"/><span>SO–Distributor Mapping</span></button>}</div>})}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">R</div><div className="profile-copy"><strong>RSM Account</strong><small>{userEmail || 'Signed in user'}</small></div></div><button className="signout" onClick={signOut}><LogOut size={17}/> লগআউট</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="menu-toggle" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb">Sales Management <ChevronRight size={14}/> <strong>{active}</strong></div><div className="top-right"><span className="today"><CalendarDays size={16}/> {new Intl.DateTimeFormat('bn-BD',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date())}</span><div className="avatar">R</div></div></header>
      <section className="content">
        <div className="welcome-row"><div><p className="eyebrow">T.K FOOD PRODUCTS DISTRIBUTION LIMITED</p><h1>{active}</h1><p className="muted">Jashore Region · Pusti Consumer Division{profile?.full_name ? ` · ${profile.full_name}` : ''}{profile?.role ? ` · ${profile.role}` : ''}</p></div><div className="status-chip"><CheckCircle2 size={16}/> {active === 'ড্যাশবোর্ড' ? 'লাইভ ডেটা সংযুক্ত' : 'মডিউল খোলা হয়েছে'}</div></div>
        {active === 'ড্যাশবোর্ড' ? <SalesDashboard profile={profile} userId={session?.user?.id} /> : active === 'টার্গেট ও অ্যাচিভমেন্ট' ? <TargetAchievement profile={profile} userId={session?.user?.id} /> : active === 'সেটিংস' ? <AdminPanel isAdmin={String(profile?.role || '').toUpperCase() === 'RSM'} /> : active === 'টিম / ইউজার' ? <EmployeeManager isAdmin={String(profile?.role || '').toUpperCase() === 'RSM'} areas={areas} /> : active === 'দৈনিক সেলস রিপোর্ট' ? <DailySalesReport profile={profile} userId={session?.user?.id} /> : active === 'অর্ডার এন্ট্রি' ? <OutletManager profile={profile} areas={areas} userId={session?.user?.id} /> : active === 'অর্ডার সামারি' ? <OrderSummary profile={profile} areas={areas} userId={session?.user?.id} /> : active === 'স্টক ও SKU' ? <SKUManager profile={profile} userId={session?.user?.id} /> : active === 'DB Stock & Return' ? <DBStockReturn profile={profile} userId={session?.user?.id} /> : active === 'SO–Distributor Mapping' ? <SODistributorMapping profile={profile} userId={session?.user?.id} areas={areas} /> : active === 'IMS Approve for ASM' ? <IMSApproveASM profile={profile} userId={session?.user?.id} /> : active === 'IMS Approve for RSM' ? <IMSApproveRSM profile={profile} userId={session?.user?.id} /> : <>
          <div className="module-detail-card"><div className="module-detail-icon">{(() => { const Icon = navItems.find(item=>item.label===active)?.icon || ClipboardList; return <Icon size={26}/>; })()}</div><h2>{active}</h2><p>এই মডিউলের জন্য প্রয়োজনীয় ফর্ম ও কার্যক্রম পরবর্তী ধাপে যুক্ত করা হবে। বিদ্যমান ডেটাবেজে এই মডিউলের পূর্ণাঙ্গ টেবিল/কলাম নেই অথবা এখনো ডেটা এন্ট্রি চালু করা হয়নি।</p><button className="primary-btn" onClick={()=>setActive('ড্যাশবোর্ড')}>ড্যাশবোর্ডে ফিরে যান <ChevronRight size={17}/></button></div>
        </>}
        <div className="integration-card"><div className="integration-icon"><Package size={22}/></div><div><strong>Supabase সংযোগ</strong><p>{supabaseConfigured ? 'Supabase client সংযুক্ত। তথ্য RLS নীতিমালা মেনে আনা হচ্ছে।' : 'Supabase configuration পাওয়া যায়নি।'}</p></div><span className={'connection-badge '+(supabaseConfigured?'connected':'pending')}>{supabaseConfigured?'Configured':'Pending'}</span></div>
        <footer>TK Sales Management <span>·</span> Secure Sales Operations</footer>
      </section>
    </main>
    <nav className="mobile-bottom">{navItems.slice(0,4).map(item=>{const Icon=item.icon;return <button key={item.label} className={active===item.label?'selected':''} onClick={()=>setActive(item.label)}><Icon size={19}/><span>{item.label==='দৈনিক সেলস রিপোর্ট'?'রিপোর্ট':item.label==='ড্যাশবোর্ড'?'হোম':item.label==='অর্ডার এন্ট্রি'?'অর্ডার':'ভিজিট'}</span></button>})}</nav>
  </div>;
}
function Stat({icon:Icon,title,value,note}) { return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className="stat-icon"><Icon size={19}/></div></div><strong className="stat-value">{value}</strong><small>{note}</small></div>; }

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    const fallback = window.setTimeout(() => { if (alive) setChecking(false); }, 8000);
    supabase.auth.getSession()
      .then(({data,error}) => {
        if (!alive) return;
        if (error) console.error('Session check:', error.message);
        setSession(data?.session || null);
        setChecking(false);
      })
      .catch(error => {
        console.error('Session check failed:', error);
        if (alive) setChecking(false);
      });
    const {data: listener} = supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession));
    return ()=>{ alive=false; window.clearTimeout(fallback); listener.subscription.unsubscribe(); };
  }, []);
  if (checking) return <div className="loading-screen"><div className="brand-mark">T.K</div><p>লোড হচ্ছে…</p></div>;
  return session ? <AppShell session={session}/> : <Login onLogin={setSession}/>;
}
