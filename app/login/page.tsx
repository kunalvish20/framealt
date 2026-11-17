'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Film, ArrowRight, Eye, EyeOff, Layers3, LockKeyhole, Cloud, ShieldCheck, Loader2 } from 'lucide-react';
import { isConfigured, supabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function LoginPage() {
  const { session, loading: authLoading, error: sessionError, retry } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const recoveryMode = useRef(false);
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    recoveryMode.current = params.get('reset') === '1' || window.location.hash.includes('type=recovery');
    setMode(recoveryMode.current ? 'reset' : params.get('signup') === '1' ? 'register' : 'login');
    setInitialized(true);
    router.prefetch('/dashboard');
  }, [router]);

  useEffect(() => {
    if (!initialized || !session || recoveryMode.current || redirected.current) return;
    redirected.current = true;
    async function afterSignIn() {
      if (!session) return;
      if (!new URLSearchParams(window.location.search).has('google')) { router.replace('/dashboard'); return; }
      let result = 'needs-connect';
      if (session.provider_token) {
        try {
          const response = await fetch('/api/integrations/google/from-login', {
            method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: session.provider_token, refreshToken: session.provider_refresh_token || null }),
          });
          if (response.ok) result = 'connected';
        } catch { /* The Drive page offers a safe reconnect without losing the login. */ }
      }
      router.replace(`/drive?google=${result}`);
    }
    void afterSignIn();
  }, [session, initialized, router]);

  function changeMode(next: AuthMode) { setMode(next); setError(''); setNotice(''); }

  async function signInGoogle() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!isConfigured()) throw new Error('Set up Supabase first.');
      const { error: authError } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: `${window.location.origin}/login?google=1`, scopes: 'https://www.googleapis.com/auth/drive.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      } });
      if (authError) throw authError;
    } catch (err) { setError(err instanceof Error ? err.message : 'Google sign-in failed'); setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!isConfigured()) throw new Error('Configure .env.local first (see README.md).');
      const sb = supabaseBrowser();
      if (mode === 'reset') {
        const { error: authError } = await sb.auth.updateUser({ password });
        if (authError) throw authError;
        const { error: signOutError } = await sb.auth.signOut();
        if (signOutError) throw signOutError;
        recoveryMode.current = false; redirected.current = false;
        window.history.replaceState(null, '', '/login');
        setPassword(''); setMode('login'); setNotice('Password updated. Sign in with your new password.');
      } else if (mode === 'forgot') {
        const { error: authError } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?reset=1` });
        if (authError) throw authError;
        setNotice('Password reset link sent. Check your inbox.');
      } else if (mode === 'register') {
        if (!name.trim()) throw new Error('Enter your name.');
        const { data, error: authError } = await sb.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } });
        if (authError) throw authError;
        if (!data.session) setNotice('Account created! Confirm your email, then sign in.');
      } else {
        const { error: authError } = await sb.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        // The root session event drives the only post-login navigation.
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); }
    finally { setBusy(false); }
  }

  const discovering = !initialized || (authLoading && isConfigured()) || (!!session && !recoveryMode.current);
  return <div className="auth-layout">
    <div className="auth-brand-panel"><Link href="/" className="login-brand"><span className="brand-symbol"><Film size={18}/></span>FreeFrame</Link>
      <div className="auth-pitch"><h1>Media review.<br/><em>Every detail,<br/>in context.</em></h1><p>Bring files, versions, and feedback together in one focused workspace.</p>
        <div className="auth-feature"><span><Layers3 size={18}/></span><div><b>Keep every version</b><small>Feedback and decisions stay with the right cut</small></div></div>
        <div className="auth-feature"><span><Cloud size={18}/></span><div><b>Connect your media</b><small>Upload to R2 or link from Google Drive</small></div></div>
        <div className="auth-feature"><span><ShieldCheck size={18}/></span><div><b>Control review access</b><small>Project roles and expiring guest links</small></div></div>
      </div><div className="auth-footnote">Video, images, and audio. One review workflow.</div>
    </div>
    <div className="auth-form-panel"><div className="auth-form-wrap"><Link href="/" className="mobile-login-brand"><span className="brand-symbol"><Film size={18}/></span>FreeFrame</Link>
      {discovering ? <div className="auth-discovery" role="status"><span className="spinner"/><span>{session ? 'Opening your workspace…' : 'Checking your session…'}</span></div> : <>
        <div className="auth-welcome">{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create an account' : mode === 'reset' ? 'Set a new password' : 'Account recovery'}</div>
        <h2>{mode === 'login' ? 'Sign in to FreeFrame' : mode === 'register' ? 'Create your workspace' : mode === 'reset' ? 'Choose a new password' : 'Forgot your password?'}</h2>
        <p className="auth-sub">{mode === 'login' ? 'Continue to your projects and reviews.' : mode === 'register' ? 'Start reviewing with your team.' : mode === 'reset' ? 'Enter a new secure password for your account.' : 'We’ll email you a link to reset it.'}</p>
        {sessionError && <div className="message error" role="alert">{sessionError} <button className="text-link" onClick={retry}>Try again</button></div>}
        <form onSubmit={event => void submit(event)} className="auth-form" aria-busy={busy}>
          {mode === 'register' && <label>Full name<input required maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" disabled={busy}/></label>}
          {mode !== 'reset' && <label>Email address<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" disabled={busy}/></label>}
          {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}<div className="password-field"><input required minLength={6} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 6 characters" disabled={busy}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>}
          {mode === 'login' && <button className="text-link forgot-link" type="button" disabled={busy} onClick={() => changeMode('forgot')}>Forgot password?</button>}
          {error && <div role="alert" className="message error">{error}</div>}{notice && <div role="status" className="message success">{notice}</div>}
          <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Update password' : 'Send reset email'}{busy ? <Loader2 size={17} className="rotating"/> : <ArrowRight size={17}/>}</button>
        </form>
        {(mode === 'login' || mode === 'register') && <div className="google-signin-wrap"><div className="google-divider">or continue with</div><button className="google-signin" type="button" onClick={() => void signInGoogle()} disabled={busy}><Cloud size={17}/> Continue with Google &amp; Drive</button><small>Includes read-only Google Drive authorization.</small></div>}
        <div className="auth-switch">{mode === 'login' ? <>New to FreeFrame? <button disabled={busy} onClick={() => changeMode('register')}>Create an account</button></> : <>Already have an account? <button disabled={busy} onClick={() => changeMode('login')}>Sign in</button></>}</div>
      </>}
    </div><div className="login-privacy"><LockKeyhole size={12}/> Secure access powered by Supabase Auth</div></div>
  </div>;
}
