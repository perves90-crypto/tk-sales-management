import { useEffect, useState } from 'react';
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
        <div className="welcome-row"><div><p className="eyebrow">T.K FOOD PRODUCTS DISTRIBUTION LIMITED</p><h1>{active}</h1><p className="muted">Jashore Region · Pusti Consumer Division</p></div><div className="status-chip"><CheckCircle2 size={16}/> অ্যাপ ইন্টারফেস প্রস্তুত</div></div>
        <div className="notice"><Activity size={19}/><div><strong>প্রাথমিক অ্যাপ কাঠামো</strong><p>এই স্ক্রিনে কোনো বিক্রয় সংখ্যা ডেমো হিসেবে দেখানো হয়নি। বাস্তব রিপোর্ট চালু করতে বিদ্যমান Supabase টেবিল ও কলাম যাচাই করে সংযোগ দিতে হবে।</p></div></div>
        <div className="section-title"><h2>রিজিয়ন ওভারভিউ</h2><span>বাস্তব ডেটা সংযোগের অপেক্ষায়</span></div>
        <div className="stats-grid">
          <Stat icon={BarChart3} title="Secondary Sales" value="—" note="ডেটা সংযুক্ত নয়"/>
          <Stat icon={Target} title="Target Achievement" value="—" note="টার্গেট ডেটা প্রয়োজন"/>
          <Stat icon={Users} title="Sales Team" value="—" note="টিম ডেটা সংযুক্ত নয়"/>
          <Stat icon={ArrowDownToLine} title="Undelivered" value="—" note="অর্ডার ডেটা প্রয়োজন"/>
        </div>
        <div className="section-title"><h2>মডিউলসমূহ</h2><span>মেনু থেকে মডিউল বাছাই করুন</span></div>
        <div className="module-grid">{navItems.slice(1,8).map(item=>{const Icon=item.icon;return <button className="module-card" key={item.label} onClick={()=>setActive(item.label)}><span className="module-icon"><Icon size={21}/></span><strong>{item.label}</strong><span className="module-arrow"><ChevronRight size={18}/></span></button>})}</div>
        <div className="integration-card"><div className="integration-icon"><Package size={22}/></div><div><strong>Supabase সংযোগ</strong><p>{supabaseConfigured ? 'Public client key সেট করা আছে। এখন বিদ্যমান schema যাচাই করে data modules যুক্ত করতে হবে।' : 'প্রজেক্ট URL ও Publishable Key Cloudflare Pages-এর Environment Variables-এ যোগ করতে হবে।'}</p></div><span className={'connection-badge '+(supabaseConfigured?'connected':'pending')}>{supabaseConfigured?'Configured':'Pending'}</span></div>
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
