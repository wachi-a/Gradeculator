import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Cloud, CloudOff, Eye, EyeOff, GraduationCap, LogIn, LogOut, Download, Upload, RefreshCw, ShieldCheck, UserRound, X } from 'lucide-react';
import { cloudConfigured, supabase } from './lib/cloud.js';

const errorText = error => {
  const message = String(error?.message || error || 'เกิดข้อผิดพลาด');
  if (/Invalid login credentials/i.test(message)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (/Email not confirmed/i.test(message)) return 'กรุณายืนยันอีเมลด้วยรหัส OTP ที่ได้รับก่อน';
  if (/token has expired|token expired|invalid otp|otp expired|token is invalid|invalid token|email otp/i.test(message)) return 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาตรวจรหัสหรือขอรหัสใหม่';
  if (/rate limit|too many requests/i.test(message)) return 'มีการใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง';
  if (/fetch|network/i.test(message)) return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้';
  return message;
};

export function AuthPanel({ onGuest, onAuthenticated, onClose, initial = 'login', isOverlay = false, recovery = false }) {
  const [formMode, setFormMode] = useState(recovery ? 'reset-password' : initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  // Start login fields empty each time the panel is mounted. Avoid silent
  // browser autofill until the user actively focuses each field.
  const [loginEmailUnlocked, setLoginEmailUnlocked] = useState(false);
  const [loginPasswordUnlocked, setLoginPasswordUnlocked] = useState(false);
  const clearCredentials = () => {
    setEmail(''); setPassword(''); setNewPassword(''); setOtp('');
    setPendingEmail(''); setShowPassword(false);
    setLoginEmailUnlocked(false); setLoginPasswordUnlocked(false);
  };
  const closePanel = () => { clearCredentials(); onClose?.(); };
  const continueAsGuest = () => { clearCredentials(); onGuest?.(); };
  const handleSubmit = async event => {
    event.preventDefault();
    if (!cloudConfigured) return;
    setBusy(true); setMessage(''); setSuccess(false);
    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
      if (formMode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session?.user) { clearCredentials(); onAuthenticated(data.session.user); }
        else {
          setPendingEmail(email.trim()); setOtp(''); setFormMode('verify-email');
          setMessage('ส่งรหัสยืนยันไปทางอีเมลแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม');
          setSuccess(true);
        }
      } else if (formMode === 'verify-email') {
        if (!pendingEmail) throw new Error('ไม่พบอีเมลที่กำลังยืนยัน กรุณาสมัครสมาชิกใหม่');
        if (!/^\d{6,8}$/.test(otp)) throw new Error('กรุณากรอกรหัสตัวเลขจากอีเมลให้ครบ');
        const { data, error } = await supabase.auth.verifyOtp({
          email: pendingEmail, token: otp, type: 'email',
        });
        if (error) throw error;
        if (!data?.user) throw new Error('ยืนยันบัญชีไม่สำเร็จ กรุณาลองใหม่');
        setOtp('');
        clearCredentials(); onAuthenticated(data.user);
      } else if (formMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setMessage('ถ้าบัญชีนี้มีอยู่ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล'); setSuccess(true);
      } else if (formMode === 'reset-password') {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setMessage('เปลี่ยนรหัสผ่านสำเร็จแล้ว'); setSuccess(true);
        setFormMode('login');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.user) { clearCredentials(); onAuthenticated(data.user); }
      }
    } catch (error) { setMessage(errorText(error)); setSuccess(false); }
    finally { setBusy(false); }
  };
  // Supabase redirects this browser tab to Google and back to Gradeculator.
  // Existing Guest scores remain stored locally until account migration is confirmed.
  const signInWithGoogle = async () => {
    if (!cloudConfigured || busy) return;
    setBusy(true); setMessage(''); setSuccess(false);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(errorText(error)); setSuccess(false);
      setBusy(false);
    }
  };
  const resendCode = async () => {
    if (!cloudConfigured || !pendingEmail || busy) return;
    setBusy(true); setMessage(''); setSuccess(false);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup', email: pendingEmail,
        options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      });
      if (error) throw error;
      setOtp(''); setMessage('ส่งรหัสยืนยันใหม่แล้ว กรุณาใช้รหัสล่าสุดในอีเมล');
      setSuccess(true);
    } catch (error) { setMessage(errorText(error)); setSuccess(false); }
    finally { setBusy(false); }
  };
  const switchMode = next => {
    clearCredentials(); setFormMode(next); setMessage(''); setSuccess(false);
  };
  const title = formMode === 'register' ? 'สร้างบัญชี Gradeculator' : formMode === 'verify-email' ? 'ยืนยันอีเมลด้วยรหัส OTP' : formMode === 'forgot' ? 'ลืมรหัสผ่าน?' : formMode === 'reset-password' ? 'ตั้งรหัสผ่านใหม่' : 'เข้าสู่ระบบ Gradeculator';
  return <div className={isOverlay ? 'account-modal-backdrop' : 'account-gateway'}>
    <section className="account-card" role={isOverlay ? 'dialog' : 'main'} aria-modal={isOverlay ? 'true' : undefined} aria-label={title}>
      {isOverlay && <button type="button" aria-label="ปิด" className="account-close" onClick={closePanel}><X size={19}/></button>}
      <div className="account-badge"><img src={`${import.meta.env.BASE_URL}icons/logo-round.svg`} alt="" className="auth-brand-logo"/></div>
      <div className="eyebrow">GRADEHUB ACCOUNT</div>
      <h1>{title}</h1>
      {!isOverlay && <p className="account-intro">Gradeculator โปรแกรมคำนวณเกรดเฉลี่ย GPA และ GPAX ออนไลน์ฟรี สำหรับนักศึกษา ใช้บันทึกคะแนนรายวิชา คิดเกรดเฉลี่ยมหาวิทยาลัย และวางแผนเกรดเป้าหมายได้ทั้งมือถือและคอมพิวเตอร์</p>}
      <p className="account-intro">ล็อกอินเพื่อซิงก์ข้อมูลรายวิชาและคะแนนระหว่างเว็บไซต์กับโทรศัพท์ หรือใช้งานแบบ Guest โดยเก็บข้อมูลไว้ในเครื่อง</p>
      {!cloudConfigured ? <div className="account-setup-warning"><CloudOff size={20}/><span>ยังไม่ได้เชื่อมต่อฐานข้อมูลออนไลน์ กรุณาตั้งค่า Supabase ตามคู่มือ SETUP_LOGIN.md ก่อน จึงจะสมัครสมาชิกและเข้าสู่ระบบได้</span></div> :
        <form onSubmit={handleSubmit} className="account-form" autoComplete="off">
          {formMode !== 'reset-password' && formMode !== 'verify-email' && <label>อีเมล<input type="email" placeholder="you@example.com"
              autoComplete={formMode === 'login' ? 'off' : 'email'}
              readOnly={formMode === 'login' && !loginEmailUnlocked}
              onFocus={() => setLoginEmailUnlocked(true)}
              required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
          {formMode === 'verify-email' && <>
            <p className="account-intro">กรอกรหัสที่ส่งไปยัง <strong>{pendingEmail}</strong> ในหน้านี้ได้เลย ไม่ต้องเปิดลิงก์ยืนยันในแท็บใหม่</p>
            <label>รหัส OTP จากอีเมล<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required
              placeholder="กรอกรหัสตัวเลข" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,8))}/></label>
          </>}
          {(formMode === 'login' || formMode === 'register') && <label>รหัสผ่าน
            <div className="password-row"><input type={showPassword ? 'text' : 'password'} autoComplete={formMode === 'register' ? 'new-password' : 'off'}
              readOnly={formMode === 'login' && !loginPasswordUnlocked}
              onFocus={() => setLoginPasswordUnlocked(true)}
              minLength={formMode === 'register' ? 8 : undefined} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={formMode === 'register' ? 'อย่างน้อย 8 ตัวอักษร' : 'รหัสผ่าน'}/><button type="button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={()=>setShowPassword(v=>!v)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
          </label>}
          {formMode === 'reset-password' && <label>รหัสผ่านใหม่<input type="password" required minLength={8} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>}
          {message && <p className={success ? 'account-message success' : 'account-message error'} role="status">{message}</p>}
          <button className="btn btn-primary account-submit" type="submit" disabled={busy}>
            {busy ? <RefreshCw size={17} className="spin-icon"/> : <LogIn size={17}/>}
            {formMode === 'register' ? 'สมัครสมาชิก' : formMode === 'verify-email' ? 'ยืนยันรหัส OTP' : formMode === 'forgot' ? 'ส่งลิงก์ตั้งรหัสผ่านใหม่' : formMode === 'reset-password' ? 'เปลี่ยนรหัสผ่าน' : 'เข้าสู่ระบบ'}
          </button>
          <div className="account-switch">
            {formMode !== 'login' && <button type="button" onClick={()=>switchMode('login')}><ArrowLeft size={14}/>กลับไปเข้าสู่ระบบ</button>}
            {formMode === 'verify-email' && <button type="button" disabled={busy} onClick={resendCode}><RefreshCw size={14}/>ส่งรหัสอีกครั้ง</button>}
            {formMode === 'login' && <><button type="button" onClick={()=>switchMode('register')}>สมัครสมาชิก</button><button type="button" onClick={()=>switchMode('forgot')}>ลืมรหัสผ่าน</button></>}
          </div>
        </form>}
      {cloudConfigured && ['login','register','verify-email'].includes(formMode) && <>
        <div className="account-divider"><span>หรือ</span></div>
        <button type="button" className="account-google-signin" onClick={signInWithGoogle} disabled={busy}>
          <span className="account-google-mark" aria-hidden="true">G</span> เข้าสู่ระบบด้วย Google
        </button>
      </>}
      <div className="account-divider"><span>หรือ</span></div>
      <button type="button" className="btn btn-outline account-guest" onClick={continueAsGuest}><UserRound size={18}/>Guest</button>
      <p className="account-footnote"><ShieldCheck size={15}/> ข้อมูล Guest จะอยู่ในเครื่องของเบราว์เซอร์นี้เท่านั้น และไม่ซิงก์ข้ามอุปกรณ์</p>
    </section>
  </div>;
}

export function CloudChoice({ cloudExists, onCloud, onGuest, onLogout, onBackup, isRecovery = false }) {
  return <div className="account-gateway"><section className="account-card decision-card" role="main">
    <div className="account-badge"><img src={`${import.meta.env.BASE_URL}icons/logo-round.svg`} alt="" className="auth-brand-logo"/></div>
    <div className="eyebrow">SYNC YOUR GRADEHUB</div>
    <h1>{isRecovery ? 'กู้คืนข้อมูลที่ยังไม่ได้ซิงก์' : 'เลือกข้อมูลที่ต้องการใช้'}</h1>
    <p className="account-intro">{isRecovery ? 'มีข้อมูลบัญชีที่แก้ไขค้างอยู่ในเครื่องนี้และยังไม่ถูกส่งขึ้นออนไลน์ กรุณาเลือกว่าจะใช้ข้อมูลออนไลน์ล่าสุด หรือใช้สำเนาในเครื่องนี้' : 'ในเครื่องนี้มีข้อมูล Guest อยู่แล้ว เลือกว่าจะใช้ข้อมูลบัญชีออนไลน์หรือย้ายข้อมูล Guest ขึ้นบัญชี (ข้อมูลเดิมในเครื่องยังอยู่)'}</p>
    <button className="btn btn-primary decision-btn" onClick={onCloud}><Cloud size={19}/>{cloudExists ? 'ใช้ข้อมูลบัญชีออนไลน์เดิม' : 'เริ่มบัญชีออนไลน์ว่างเปล่า'}</button>
    <button className="btn btn-outline decision-btn" onClick={onGuest}><Cloud size={19}/>{isRecovery ? 'ใช้ข้อมูลบัญชีที่ค้างอยู่ในเครื่องนี้' : cloudExists ? 'ย้ายข้อมูล Guest ขึ้นบัญชี (แทนข้อมูลออนไลน์)' : 'ย้ายข้อมูล Guest ขึ้นบัญชีใหม่'}</button>
    <button type="button" className="account-backup-btn" onClick={onBackup}>สำรองข้อมูลในเครื่องเป็น JSON ก่อนเลือก</button>
    <p className="account-footnote">{isRecovery ? 'แนะนำให้สำรอง JSON ก่อนเปลี่ยนข้อมูล หากไม่แน่ใจให้กลับไปใช้ Guest แล้วค่อยแก้ไขภายหลัง' : 'ข้อมูล Guest ต้นฉบับยังเก็บอยู่ในเบราว์เซอร์นี้ ไม่ได้ถูกลบทิ้ง และมีปุ่ม Export JSON ให้สำรองได้เสมอ'}</p>
    <button className="text-link" onClick={onLogout}>กลับไปใช้ Guest</button>
  </section></div>;
}

export function CloudConflict({ onUseCloud, onOverwrite, onLogout, onBackup }) {
  return <div className="account-modal-backdrop"><section className="account-card decision-card" role="dialog" aria-modal="true" aria-label="ข้อมูลออนไลน์เปลี่ยนจากอีกเครื่อง">
    <div className="account-badge alert"><img src={`${import.meta.env.BASE_URL}icons/logo-round.svg`} alt="" className="auth-brand-logo"/></div>
    <h1>พบข้อมูลที่แก้ไขจากอีกอุปกรณ์</h1>
    <p className="account-intro">ระบบหยุดการซิงก์เพื่อป้องกันการเขียนทับคะแนนจากอีกเครื่อง ข้อมูลที่กำลังแก้บนเครื่องนี้ยังเก็บไว้เป็นสำเนาเฉพาะบัญชี</p>
    <button className="account-backup-btn" onClick={onBackup}>ดาวน์โหลดข้อมูลเครื่องนี้เป็น JSON ก่อนตัดสินใจ</button>
    <button className="btn btn-primary decision-btn" onClick={onUseCloud}><RefreshCw size={18}/>โหลดข้อมูลออนไลน์ล่าสุด</button>
    <button className="btn btn-outline decision-btn" onClick={onOverwrite}>ใช้ข้อมูลเครื่องนี้แทน (ต้องยืนยัน)</button>
    <button className="text-link" onClick={onLogout}>ออกจากระบบโดยเก็บข้อมูลสำรองไว้ในเครื่อง</button>
  </section></div>;
}

export function AccountHeader({ user, syncStatus, onLogin, onLogout, onRefresh, onExport, onImport }) {
  const [open, setOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [savedName, setSavedName] = useState('');
  const menuRef = React.useRef(null);
  const statusLabel = { synced:'ซิงก์แล้ว', syncing:'กำลังซิงก์', pending:'รอซิงก์', offline:'ออฟไลน์', conflict:'ข้อมูลชนกัน' }[syncStatus] || 'ระบบคลาวด์';
  const hasGoogle = Boolean(user?.identities?.some(identity => identity.provider === 'google'));
  React.useEffect(() => {
    setDisplayName(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
    setSavedName('');
    setOpen(false);
  }, [user?.id]);
  React.useEffect(() => {
    if (!open) return;
    const onOutside = event => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown',onOutside); document.removeEventListener('keydown',onKey); };
  }, [open]);
  const saveName = async event => {
    event.preventDefault();
    if (!displayName.trim() || nameBusy) return;
    setNameBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } });
      if (error) throw error;
      setSavedName('บันทึกชื่อแล้ว');
    } catch (error) { setSavedName(errorText(error)); }
    finally { setNameBusy(false); }
  };
  const linkGoogle = async () => {
    if (!user || !cloudConfigured || hasGoogle || linkBusy) return;
    if (syncStatus !== 'synced') {
      window.alert('กรุณารอจนขึ้นสถานะ “ซิงก์แล้ว” ก่อนเชื่อม Google');
      return;
    }
    setLinkBusy(true);
    try {
      const { error } = await supabase.auth.linkIdentity({ provider: 'google',
        options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } });
      if (error) throw error;
    } catch (error) {
      window.alert('เชื่อม Google ไม่สำเร็จ: ' + errorText(error));
      setLinkBusy(false);
    }
  };
  if (!user) return <button className="btn btn-outline account-login-btn" type="button" onClick={onLogin}><LogIn size={17}/> Login</button>;
  return <div className="account-menu-wrap" ref={menuRef}>
    <button type="button" className="account-profile-trigger" title="บัญชีของฉัน"
      aria-label="เปิดเมนูบัญชี" aria-expanded={open} onClick={() => setOpen(v=>!v)}>
      <UserRound size={21}/>
    </button>
    {open && <div className="account-profile-menu" role="region" aria-label="ข้อมูลบัญชี Gradeculator">
      <div className="account-profile-heading">
        <div className="account-profile-avatar"><UserRound size={23}/></div>
        <div><strong>{displayName.trim() || user?.user_metadata?.full_name || 'บัญชีของฉัน'}</strong>
          <span>{user.email}</span></div>
      </div>
      <form className="account-name-form" onSubmit={saveName}>
        <label htmlFor="gradeculator-profile-name">ชื่อ–นามสกุล</label>
        <div><input id="gradeculator-profile-name" type="text" maxLength={80} placeholder="เพิ่มชื่อ–นามสกุล"
          value={displayName} onChange={e=>{setDisplayName(e.target.value);setSavedName('');}}/>
          <button type="submit" disabled={nameBusy || !displayName.trim()} title="บันทึกชื่อ">บันทึก</button></div>
        {savedName && <small role="status">{savedName}</small>}
      </form>
      <div className="account-menu-status"><span className={'sync-indicator ' + (syncStatus || '')}>
        {syncStatus === 'synced' ? <CheckCircle2 size={15}/> : <CloudOff size={15}/>} {statusLabel}
        </span><button onClick={onRefresh} type="button" title="ซิงก์ข้อมูลอีกครั้ง"><RefreshCw size={17}/> รีเฟรช</button></div>
      <div className="account-menu-actions">
        {!hasGoogle && <button type="button" disabled={linkBusy} onClick={linkGoogle}>
          <span className="account-google-mark" aria-hidden="true">G</span> เชื่อม Google
        </button>}
        <button type="button" onClick={()=>{onExport?.();setOpen(false);}}><Download size={17}/>สำรอง JSON</button>
        <button type="button" disabled={syncStatus !== 'synced'} onClick={()=>{onImport?.();setOpen(false);}}>
          <Upload size={17}/>นำเข้า JSON ส่วนตัว</button>
        <button type="button" className="account-menu-logout" onClick={()=>{setOpen(false);onLogout?.();}}>
          <LogOut size={17}/>ออกจากระบบ</button>
      </div>
    </div>}
  </div>;
}
