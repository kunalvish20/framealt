'use client';
import { FormEvent,useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film,ArrowRight,Eye,EyeOff,Layers3,LockKeyhole,Cloud,ShieldCheck } from 'lucide-react';
import { isConfigured,supabaseBrowser } from '@/lib/supabase-browser';
export default function LoginPage(){
 const router=useRouter();const googleHandled=useRef(false);const [mode,setMode]=useState<'login'|'register'|'forgot'|'reset'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  if(!isConfigured())return;
  const recovery=new URLSearchParams(window.location.search).get('reset')==='1'||window.location.hash.includes('type=recovery');
  if(recovery)setMode('reset');
  const afterSignIn=async(session:import('@supabase/supabase-js').Session|null)=>{
   if(!session)return;
   if(!new URLSearchParams(window.location.search).has('google')){router.replace('/');return;}
   if(googleHandled.current)return;googleHandled.current=true;
   let result='needs-connect';
   if(session.provider_token){
    try{
     const res=await fetch('/api/integrations/google/from-login',{method:'POST',headers:{'Authorization':`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({accessToken:session.provider_token,refreshToken:session.provider_refresh_token||null})});
     if(res.ok)result='connected';
    }catch{}
   }
   router.replace(`/drive?google=${result}`);
  };
  if(!recovery)void supabaseBrowser().auth.getSession().then(({data})=>void afterSignIn(data.session));
  const {data:{subscription}}=supabaseBrowser().auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY')setMode('reset');
   else if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&session){setTimeout(()=>void afterSignIn(session),0);}
  });
  return()=>subscription.unsubscribe();
 },[router]);
 async function signInGoogle(){setBusy(true);setError('');try{
  if(!isConfigured())throw new Error('Set up Supabase first.');
  const {error}=await supabaseBrowser().auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/login?google=1`,scopes:'https://www.googleapis.com/auth/drive.readonly',queryParams:{access_type:'offline',prompt:'consent'}}});
  if(error)throw error;
 }catch(err){setError(err instanceof Error?err.message:'Google sign-in failed');setBusy(false);}}
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  if(!isConfigured())throw new Error('Configure .env.local first (see README.md).');
  const sb=supabaseBrowser();
  if(mode==='reset'){const {error}=await sb.auth.updateUser({password});if(error)throw error;await sb.auth.signOut();setPassword('');setMode('login');setNotice('Password updated. Sign in with your new password.');}
  else if(mode==='forgot'){const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/login?reset=1`});if(error)throw error;setNotice('Password reset link sent. Check your inbox.');}
  else if(mode==='register'){if(!name.trim())throw new Error('Enter your name.');const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name.trim()}}});if(error)throw error;if(data.session)router.replace('/');else setNotice('Account created! Confirm your email, then sign in.');}
  else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;router.replace('/');router.refresh();}
 }catch(err){setError(err instanceof Error?err.message:'Login failed');}finally{setBusy(false);}}
 return <div className="auth-layout"><div className="auth-brand-panel"><div className="login-brand"><span className="brand-symbol"><Film size={22}/></span> FreeFrame<span className="brand-cloud">cloud</span></div><div className="auth-pitch"><div className="eyebrow-light">THE CREATIVE REVIEW WORKSPACE</div><h1>Great work<br/>deserves <em>great<br/>feedback.</em></h1><p>Upload your work. Share with your team. Collect feedback on the exact moment that matters.</p><div className="auth-feature"><span><Layers3 size={19}/></span><div><b>Frame-precise review</b><small>Every comment, at the right moment</small></div></div><div className="auth-feature"><span><Cloud size={19}/></span><div><b>Files stay on your cloud</b><small>Private Cloudflare R2 storage</small></div></div><div className="auth-feature"><span><ShieldCheck size={19}/></span><div><b>Secure collaboration</b><small>Supabase authentication & permissions</small></div></div></div><div className="auth-footnote">Your creative workflow. Your infrastructure.</div></div>
  <div className="auth-form-panel"><div className="auth-form-wrap"><div className="mobile-login-brand"><Film size={22}/> FreeFrame cloud</div><div className="auth-welcome">{mode==='login'?'Welcome back':mode==='register'?'Create an account':mode==='reset'?'Set a new password':'Reset password'}</div><h2>{mode==='login'?'Sign in to your workspace':mode==='register'?'Start collaborating':mode==='reset'?'Choose your new password':'Forgot your password?'}</h2><p className="auth-sub">{mode==='login'?'Enter your account details to continue.':mode==='register'?'Your creative work, all in one place.':mode==='reset'?'Enter a new secure password for your account.':'We’ll email you a link to reset it.'}</p>
  <form onSubmit={submit} className="auth-form">{mode==='register'&&<label>Full name<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
  {mode!=='reset'&&<label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label>}
  {mode!=='forgot'&&<label>{mode==='reset'?'New password':'Password'}<div className="password-field"><input required minLength={6} type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}
  {mode==='login'&&<button className="text-link forgot-link" type="button" onClick={()=>{setMode('forgot');setError('');setNotice('');}}>Forgot password?</button>}
  {error&&<div role="alert" className="message error">{error}</div>}{notice&&<div role="status" className="message success">{notice}</div>}
  <button className="btn btn-primary auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':mode==='register'?'Create account':mode==='reset'?'Update password':'Send reset email'} <ArrowRight size={18}/></button></form>
  {(mode==='login'||mode==='register')&&<div className="google-signin-wrap"><div className="google-divider">or continue with</div><button className="google-signin" type="button" onClick={()=>void signInGoogle()} disabled={busy}><span className="google-g">G</span> Continue with Google &amp; Drive</button><small>Sign in and approve read-only Google Drive access once.</small></div>}
  <div className="auth-switch">{mode==='login'?<>New to FreeFrame? <button onClick={()=>{setMode('register');setNotice('');setError('');}}>Create an account</button></>:<>Already have an account? <button onClick={()=>{setMode('login');setNotice('');setError('');}}>Sign in</button></>}</div>
  </div><div className="login-privacy"><LockKeyhole size={14}/> Secure access powered by Supabase Auth</div></div></div>;
}
