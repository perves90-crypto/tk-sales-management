import React, { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './lib/supabase';
import {
  Activity, ArrowDownToLine, BarChart3, Boxes, CalendarDays, CheckCircle2,
  ChevronRight, ClipboardList, Gauge, LogOut, MapPinned, Menu, Package,
  Settings, ShieldCheck, ShoppingCart, Target, Users, X
} from 'lucide-react';

const navItems = [
  { label: 'ড্যাশবোর্ড', icon: Gauge },
  { label: 'দৈনিক সেলস রিপোর্ট', icon: BarChart3 },
  { label: 'অর্ডার এন্ট্রি', icon: ShoppingCart },
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
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
        <label>ইমেইল</label>
        <input type="email" autoComplete="username" placeholder="আপনার নিবন্ধিত Gmail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <label>পাসওয়ার্ড</label>
        <input type="password" autoComplete="current-password" placeholder="পাসওয়ার্ড লিখুন" value={password} onChange={e=>setPassword(e.target.value)} required />
        {error && <div className="error-box">{error}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'লগইন হচ্ছে…' : 'লগইন করুন'} <ChevronRight size={18}/></button>
      </form>
      <p className="footnote">শুধু অনুমোদিত কর্মীদের জন্য। আপনার পাসওয়ার্ড কারও সঙ্গে শেয়ার করবেন না।</p>
    </section>
  </main>;
}

function AppShell({ session }) {
  const [active, setActive] = useState('ড্যাশবোর্ড');
  const [mobileNav, setMobileNav] = useState(false);
  const [userEmail, setUserEmail] = useState(session?.user?.email || '');
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasError, setAreasError] = useState('');
  const [profile, setProfile] = useState(null);
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
      <nav>{navItems.map(item => {const Icon=item.icon; return <button key={item.label} className={'nav-item '+(active===item.label?'active':'')} onClick={()=>{setActive(item.label);setMobileNav(false)}}><Icon size={18}/><span>{item.label}</span>{active===item.label&&<span className="nav-indicator"/>}</button>})}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">R</div><div className="profile-copy"><strong>RSM Account</strong><small>{userEmail || 'Signed in user'}</small></div></div><button className="signout" onClick={signOut}><LogOut size={17}/> লগআউট</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="menu-toggle" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb">Sales Management <ChevronRight size={14}/> <strong>{active}</strong></div><div className="top-right"><span className="today"><CalendarDays size={16}/> {new Intl.DateTimeFormat('bn-BD',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date())}</span><div className="avatar">R</div></div></header>
      <section className="content">
        <div className="welcome-row"><div><p className="eyebrow">T.K FOOD PRODUCTS DISTRIBUTION LIMITED</p><h1>{active}</h1><p className="muted">Jashore Region · Pusti Consumer Division{profile?.full_name ? ` · ${profile.full_name}` : ''}{profile?.role ? ` · ${profile.role}` : ''}</p></div><div className="status-chip"><CheckCircle2 size={16}/> {active === 'ড্যাশবোর্ড' ? 'লাইভ ডেটা সংযুক্ত' : 'মডিউল খোলা হয়েছে'}</div></div>
        {active === 'ড্যাশবোর্ড' ? <>
          <div className="notice"><Activity size={19}/><div><strong>প্রাথমিক অ্যাপ কাঠামো</strong><p>বিক্রয় ও টার্গেটের তথ্য এখনো ডেটাবেজে নেই। কোনো কাল্পনিক সংখ্যা দেখানো হচ্ছে না।</p></div></div>
          <div className="section-title"><h2>রিজিয়ন ওভারভিউ</h2><span>বাস্তব ডেটা</span></div>
          <div className="stats-grid">
            <Stat icon={BarChart3} title="Secondary Sales" value="—" note="Sales report নেই"/>
            <Stat icon={Target} title="Target Achievement" value="—" note="Target data নেই"/>
            <Stat icon={Users} title="Sales Team" value={team.length ? team.length.toLocaleString('bn-BD') : '১'} note="বর্তমান Profile: ১"/>
            <Stat icon={ArrowDownToLine} title="Undelivered" value="—" note="Order table নেই"/>
          </div>
          <div className="section-title"><h2>এরিয়া তালিকা</h2><span>Supabase থেকে সরাসরি</span></div>
          <div className="area-list-card">
            {areasLoading ? <p className="area-state">এরিয়ার তথ্য লোড হচ্ছে…</p> : areasError ? <p className="area-state area-error">এরিয়ার তথ্য আনা যায়নি: {areasError}</p> : areas.length === 0 ? <p className="area-state">কোনো এরিয়া পাওয়া যায়নি।</p> : <>
              <div className="area-summary"><strong>{areas.length.toLocaleString('bn-BD')}</strong><span>টি এরিয়া পাওয়া গেছে</span></div>
              <div className="area-chips">{areas.map(area => <div className="area-chip" key={area.id}><span className="area-dot"/><strong>{area.name}</strong><small>{area.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</small></div>)}</div>
            </>}
          </div>
          <div className="section-title"><h2>মডিউলসমূহ</h2><span>যেকোনো মডিউলে চাপ দিন</span></div>
          <div className="module-grid">{navItems.slice(1,8).map(item=>{const Icon=item.icon;return <button className="module-card" key={item.label} onClick={()=>setActive(item.label)}><span className="module-icon"><Icon size={21}/></span><strong>{item.label}</strong><span className="module-arrow"><ChevronRight size={18}/></span></button>})}</div>
        </> : active === 'টিম / ইউজার' ? <>
          <div className="notice"><Users size={19}/><div><strong>কর্মী তালিকা</strong><p>Supabase-এর profiles টেবিল থেকে অনুমোদিত কর্মীদের তথ্য দেখানো হচ্ছে। বর্তমানে নতুন কর্মী যোগ করার ফর্ম চালু করা হয়নি।</p></div></div>
          <div className="section-title"><h2>Registered Users</h2><span>{team.length.toLocaleString('bn-BD')} জন</span></div>
          <div className="team-list-card">
            {teamLoading ? <p className="area-state">কর্মীদের তথ্য লোড হচ্ছে…</p> : teamError ? <p className="area-state area-error">তথ্য আনা যায়নি: {teamError}</p> : team.length === 0 ? <p className="area-state">আপনার Role অনুযায়ী কোনো কর্মী দেখার অনুমতি পাওয়া যায়নি।</p> : team.map(member => <div className="team-row" key={member.id}><div className="avatar">{(member.full_name || 'U').slice(0,1)}</div><div className="team-details"><strong>{member.full_name || 'নাম দেওয়া হয়নি'}</strong><small>Employee ID: {member.employee_id || '—'} · Role: {member.role || '—'}</small></div><span className={member.active ? 'member-active' : 'member-inactive'}>{member.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span></div>)}
          </div>
        </> : <>
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
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setChecking(false);});
    const {data: listener} = supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession));
    return ()=>listener.subscription.unsubscribe();
  }, []);
  if (checking) return <div className="loading-screen"><div className="brand-mark">T.K</div><p>লোড হচ্ছে…</p></div>;
  return session ? <AppShell session={session}/> : <Login onLogin={setSession}/>;
}
