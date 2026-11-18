import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Check, Globe2, Languages, LockKeyhole, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate(); const location = useLocation(); const { login } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const next = new URLSearchParams(location.search).get('next') || '/dashboard';

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault(); if (loading) return; // blocks double submits
    setLoading(true); setError('');
    try { await login(email, password, rememberMe); navigate(next, { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login failed. Check the server and try again.'); }
    finally { setLoading(false); }
  };
  return <div className="auth-shell"><section className="auth-story"><Link to="/" className="brand"><span className="brand-mark"><Globe2 size={22}/></span><span>lingua<span className="brand-accent">meet</span><small>AI meeting companion</small></span></Link><motion.div className="auth-story-content" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}><span className="eyebrow">GOOD CONVERSATIONS, WITHOUT BORDERS</span><h1>Everyone deserves<br/>to be <em>understood.</em></h1><p>Meet in your language. Leave with a shared understanding of what matters.</p><div className="auth-visual-card"><div className="auth-visual-top"><span className="live-dot"/> Live meeting <span>Hindi → English</span></div><div className="auth-translation"><span><Languages size={14}/> LIVE TRANSLATION</span><p className="auth-translation-hindi">“आइए अगले कदम तय करें।”</p><p>“Let’s agree on the next steps.”</p></div></div><div className="auth-benefits"><span><Check size={14}/> Live captions</span><span><Check size={14}/> AI meeting notes</span><span><Check size={14}/> Clear next steps</span></div></motion.div><div className="auth-story-footer"><LockKeyhole size={14}/> Your workspace is yours. Conversations stay private.</div></section>
  <main className="auth-form-side"><motion.div className="auth-form-card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.35}}><div className="auth-mobile-brand"><Link to="/" className="brand"><span className="brand-mark"><Globe2 size={20}/></span><span>lingua<span className="brand-accent">meet</span></span></Link></div><div className="auth-form-eyebrow"><span className="auth-form-spark"><Sparkles size={15}/></span> WELCOME BACK</div><h2>Sign in to your workspace</h2><p className="auth-form-description">Pick up the conversation right where you left off.</p>{error&&<div role="alert" className="auth-error">{error}</div>}<form onSubmit={handleLogin} className="auth-form"><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label><label><span className="auth-label-row">Password <Link to="/forgot-password">Forgot password?</Link></span><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></label><label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)}/> <span>Keep me signed in on this device</span></label><button type="submit" disabled={loading} className="button button-primary auth-submit">{loading?'Signing in…':'Sign in'} <ArrowRight size={17}/></button></form><div className="auth-form-divider"><span/>or<span/></div><p className="auth-switch">New to Lingua Meet? <Link to={`/signup${location.search}`}>Create an account <ArrowRight size={14}/></Link></p><p className="auth-legal">By continuing, you agree to use this workspace responsibly.</p></motion.div></main></div>;
}
