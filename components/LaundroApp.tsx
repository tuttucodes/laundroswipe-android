'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  COLLEGES,
  SERVICES,
  VENDOR,
  statusLabel,
  statusClass,
  next10Days,
} from '@/lib/constants';
import { LSApi } from '@/lib/api';
import type { UserRow, VendorBillRow } from '@/lib/api';
import type { OrderRow } from '@/lib/api';

type Screen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'signup'
  | 'student-signup'
  | 'complete-profile'
  | 'home'
  | 'schedule'
  | 'orders'
  | 'profile'
  | 'order-detail'
  | 'token-success'
  | 'my-bills'
  | 'coming-soon';

type User = {
  fn: string;
  em: string;
  ph?: string;
  wa?: string;
  ut: string;
  rn?: string;
  cid?: string;
  hos?: string;
  yr?: number;
  sid: string;
  displayId?: string;
};

type Order = {
  id: string;
  on: string;
  tk: string;
  svc: string;
  sl: string;
  pd: string;
  ts: string;
  ins?: string;
  status: string;
  ca: string;
  deliveryConfirmedAt?: string | null;
  deliveryComments?: string | null;
};

type ScheduleData = {
  step: number;
  svc?: string;
  date?: string;
  ts?: string;
  ins?: string;
};

type DetailData = {
  oid?: string;
  college?: string;
};

type Toast = { msg: string; type: 'ok' | 'er' | null } | null;

function rowToUser(r: UserRow): User {
  return {
    fn: r.full_name ?? '',
    em: r.email ?? '',
    ph: r.phone ?? undefined,
    wa: r.whatsapp ?? undefined,
    ut: r.user_type ?? 'general',
    rn: r.reg_no ?? undefined,
    cid: r.college_id ?? undefined,
    hos: r.hostel_block ?? undefined,
    yr: r.year ?? undefined,
    sid: r.id,
    displayId: r.display_id ?? undefined,
  };
}

function rowToOrder(r: OrderRow): Order {
  return {
    id: r.id,
    on: r.order_number,
    tk: r.token,
    deliveryConfirmedAt: r.delivery_confirmed_at ?? undefined,
    deliveryComments: r.delivery_comments ?? undefined,
    svc: r.service_id,
    sl: r.service_name,
    pd: r.pickup_date,
    ts: r.time_slot,
    ins: r.instructions ?? undefined,
    status: r.status,
    ca: r.created_at,
  };
}

const TIME_SLOTS = [
  { id: 'afternoon', label: 'Afternoon (12–4 PM)', emoji: '☀️' },
];

function validateIndianPhone(value: string): { valid: boolean; message?: string } {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return { valid: true };
  if (digits.length === 11 && digits.startsWith('0')) return { valid: true };
  if (digits.length === 12 && digits.startsWith('91')) return { valid: true };
  return { valid: false, message: 'Enter a valid 10-digit mobile number' };
}

export default function LaundroApp() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sd, setSd] = useState<ScheduleData>({ step: 1 });
  const [dd, setDd] = useState<DetailData>({});
  const [obSlide, setObSlide] = useState<0 | 1 | 2>(0);
  const [toast, setToast] = useState<Toast>(null);

  // Form state for auth
  const [loginEm, setLoginEm] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [signupFn, setSignupFn] = useState('');
  const [signupEm, setSignupEm] = useState('');
  const [signupPh, setSignupPh] = useState('');
  const [signupWa, setSignupWa] = useState('');
  const [signupPw, setSignupPw] = useState('');
  const [studentRn, setStudentRn] = useState('');
  const [studentCid, setStudentCid] = useState('');
  const [studentHos, setStudentHos] = useState('');
  const [studentYr, setStudentYr] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [signupPhErr, setSignupPhErr] = useState('');
  const [signupWaErr, setSignupWaErr] = useState('');
  const [deliveryComments, setDeliveryComments] = useState('');
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [myBills, setMyBills] = useState<VendorBillRow[]>([]);
  const [myBillsLoading, setMyBillsLoading] = useState(false);

  const go = useCallback((s: Screen, detail?: DetailData) => {
    setScreen(s);
    if (detail) setDd(detail);
  }, []);

  const showToast = useCallback((msg: string, type: 'ok' | 'er' | null = null) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const saveUser = useCallback((u: User | null) => {
    if (u) localStorage.setItem('ls_u', JSON.stringify(u));
    else localStorage.removeItem('ls_u');
  }, []);

  const saveO = useCallback((o: Order[]) => {
    localStorage.setItem('ls_o', JSON.stringify(o));
  }, []);

  const genTk = useCallback(() => {
    const t = Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const r = String(Math.floor(1000 + Math.random() * 9000));
    return (t.slice(-5) + r).slice(-8);
  }, []);

  const genOid = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const n = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0');
    return `LS-${y}${m}${d}-${n}`;
  }, []);

  useEffect(() => {
    let mounted = true;
    const lsOb = typeof window !== 'undefined' ? localStorage.getItem('ls_ob') : null;
    const lsU = typeof window !== 'undefined' ? localStorage.getItem('ls_u') : null;
    const lsO = typeof window !== 'undefined' ? localStorage.getItem('ls_o') : null;
    let restoredUser: User | null = null;
    let restoredOrders: Order[] = [];
    try {
      if (lsU) restoredUser = JSON.parse(lsU) as User;
      if (lsO) restoredOrders = JSON.parse(lsO) as Order[];
    } catch (_) {}
    setUser(restoredUser);
    setOrders(restoredOrders);

    const t = setTimeout(() => {
      if (!mounted) return;
      if (screen === 'splash') setScreen(lsOb ? 'login' : 'onboarding');
    }, 900);

    async function tryApplySession(session: { user: unknown } | null) {
      if (!mounted || !session?.user) return false;
      const profile = await LSApi.upsertUserFromAuth(session.user as { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string } });
      if (!profile) return false;
      const u = rowToUser(profile);
      setUser(u);
      saveUser(u);
      const ords = await LSApi.fetchOrdersForUser(profile.id);
      if (mounted && ords) {
        const mapped = ords.map(rowToOrder);
        setOrders(mapped);
        saveO(mapped);
      }
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      const needsProfile = !profile.phone?.trim();
      if (needsProfile) {
        setScreen('complete-profile');
        showToast('Complete your profile', 'ok');
      } else {
        setScreen('home');
        showToast('Signed in with Google!', 'ok');
      }
      return true;
    }

    async function init() {
      let session = await LSApi.getAuthSession();
      if (!mounted) return;
      if (session?.user) {
        await tryApplySession(session);
        return;
      }
      // After OAuth redirect, tokens can be in the URL hash; Supabase may need a moment to process.
      const hasHash = typeof window !== 'undefined' && window.location.hash && /access_token|refresh_token/.test(window.location.hash);
      if (hasHash) {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 200));
          if (!mounted) return;
          session = await LSApi.getAuthSession();
          if (session?.user) {
            const applied = await tryApplySession(session);
            if (applied) return;
          }
        }
      }
      if (LSApi.hasSupabase && restoredUser?.sid) {
        const ords = await LSApi.fetchOrdersForUser(restoredUser.sid);
        if (mounted && ords) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
        if (mounted && restoredUser) setScreen('home');
      } else if (restoredUser) {
        setScreen('home');
      }
    }
    init();
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (user) saveUser(user);
  }, [user, saveUser]);
  useEffect(() => {
    saveO(orders);
  }, [orders, saveO]);

  const handleObNext = () => {
    if (obSlide < 2) setObSlide((obSlide + 1) as 0 | 1 | 2);
    else {
      if (typeof window !== 'undefined') localStorage.setItem('ls_ob', '1');
      setScreen('login');
    }
  };
  const handleObSkip = () => {
    if (typeof window !== 'undefined') localStorage.setItem('ls_ob', '1');
    setScreen('login');
  };

  const handleLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEm.trim()) {
      showToast('Enter email or phone', 'er');
      return;
    }
    if (!LSApi.hasSupabase) {
      showToast('Service unavailable. Configure Supabase (see deployment).', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const users = await LSApi.fetchUsers();
      const match = users?.find(
        (u) =>
          (u.email && u.email.toLowerCase() === loginEm.trim().toLowerCase()) ||
          (u.phone && u.phone === loginEm.trim())
      );
      if (match) {
        const u = rowToUser(match);
        setUser(u);
        saveUser(u);
        const ords = await LSApi.fetchOrdersForUser(match.id);
        if (ords) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
        go('home');
        showToast('Welcome back!', 'ok');
      } else {
        showToast('Account not found. Please sign up.', 'er');
      }
    } catch (_) {
      showToast('Login failed', 'er');
    }
    setAuthLoading(false);
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    const { error } = await LSApi.signInWithGoogle();
    if (error) {
      showToast(error.message || 'Google sign-in failed', 'er');
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupPhErr('');
    setSignupWaErr('');
    const phCheck = validateIndianPhone(signupPh.trim());
    const waCheck = validateIndianPhone(signupWa.trim());
    if (!phCheck.valid) {
      setSignupPhErr(phCheck.message || 'Invalid phone');
      return;
    }
    if (!waCheck.valid) {
      setSignupWaErr(waCheck.message || 'Invalid WhatsApp');
      return;
    }
    if (!signupFn.trim() || !signupEm.trim()) {
      showToast('Fill all required fields', 'er');
      return;
    }
    const isGeneral = !studentCid || studentCid === 'general';
    if (!isGeneral && !studentRn.trim()) {
      showToast('Registration number required for students', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const { user: row, error } = await LSApi.createUser({
        fn: signupFn.trim(),
        em: signupEm.trim(),
        ph: signupPh.trim(),
        wa: signupWa.trim(),
        ut: isGeneral ? 'general' : 'student',
        rn: isGeneral ? undefined : studentRn.trim(),
        cid: isGeneral ? undefined : studentCid,
        hos: studentHos.trim() || undefined,
        yr: studentYr ? parseInt(studentYr, 10) : undefined,
      });
      if (row) {
        const u = rowToUser(row);
        setUser(u);
        saveUser(u);
        go('home');
        showToast('Account created', 'ok');
      } else {
        showToast(error || 'Sign up failed', 'er');
      }
    } catch (_) {
      showToast('Sign up failed', 'er');
    }
    setAuthLoading(false);
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupPhErr('');
    setSignupWaErr('');
    const phCheck = validateIndianPhone(signupPh.trim());
    const waCheck = validateIndianPhone(signupWa.trim());
    if (!phCheck.valid) {
      setSignupPhErr(phCheck.message || 'Invalid phone');
      return;
    }
    if (!waCheck.valid) {
      setSignupWaErr(waCheck.message || 'Invalid WhatsApp');
      return;
    }
    if (!user?.sid) return;
    const isGeneral = !studentCid || studentCid === 'general';
    if (!isGeneral && !studentRn.trim()) {
      showToast('Registration number required for students', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const updated = await LSApi.updateUser(user.sid, {
        phone: signupPh.trim(),
        whatsapp: signupWa.trim(),
        user_type: isGeneral ? 'general' : 'student',
        college_id: isGeneral ? null : studentCid,
        reg_no: isGeneral ? null : studentRn.trim() || null,
        hostel_block: studentHos.trim() || null,
        year: studentYr ? parseInt(studentYr, 10) : null,
      });
      if (updated) {
        const u = rowToUser(updated);
        setUser(u);
        saveUser(u);
        go('home');
        showToast('Profile complete', 'ok');
      } else {
        showToast('Update failed', 'er');
      }
    } catch (_) {
      showToast('Update failed', 'er');
    }
    setAuthLoading(false);
  };

  const handleScheduleService = (svcId: string) => {
    setSd((s) => ({ ...s, step: 2, svc: svcId }));
  };

  const handleScheduleDateSlot = (date: string, ts: string, ins: string) => {
    setSd((s) => ({ ...s, step: 3, date, ts, ins }));
  };

  const handleConfirmOrder = async () => {
    if (!user || !sd.svc || !sd.date || !sd.ts) return;
    const svc = SERVICES.find((x) => x.id === sd.svc);
    const payload = {
      on: genOid(),
      tk: genTk(),
      svc: sd.svc,
      sl: svc?.name ?? sd.svc,
      pd: sd.date,
      ts: sd.ts,
      status: 'scheduled',
      ins: sd.ins ?? undefined,
    };
    setOrderSubmitting(true);
    try {
      const row = await LSApi.createOrder(payload, user.sid);
      if (row) {
        const newOrder = rowToOrder(row);
        setOrders((prev) => [newOrder, ...prev]);
        saveO([newOrder, ...orders]);
        setSd({ step: 1 });
        go('token-success', { oid: row.id });
      } else {
        showToast('Order failed', 'er');
      }
    } catch (_) {
      showToast('Order failed', 'er');
    }
    setOrderSubmitting(false);
  };

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingDelivery(true);
    try {
      const updated = await LSApi.confirmDelivery(orderId, deliveryComments.trim() || undefined);
      if (updated) {
        const u = rowToOrder(updated);
        const newOrders = orders.map((o) => (o.id === orderId ? u : o));
        setOrders(newOrders);
        saveO(newOrders);
        setDeliveryComments('');
        showToast('Thanks for confirming!', 'ok');
      } else {
        showToast('Could not confirm', 'er');
      }
    } catch (_) {
      showToast('Could not confirm', 'er');
    }
    setConfirmingDelivery(false);
  };

  const handleLogout = async () => {
    await LSApi.signOutAuth();
    setUser(null);
    setOrders([]);
    localStorage.removeItem('ls_u');
    localStorage.removeItem('ls_o');
    setScreen('login');
    showToast('Signed out', 'ok');
  };

  const days = next10Days().filter((d) => d.ok);
  const selectedSvc = SERVICES.find((s) => s.id === sd.svc);
  const selectedTs = TIME_SLOTS.find((t) => t.id === sd.ts);

  if (screen === 'splash') {
    return (
      <div className="splash" id="splash">
        <div className="splash-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2>LaundroSwipe</h2>
        <p>Your laundry sorted in one swipe</p>
        <div className="splash-l" />
        <div className="splash-legal">
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    );
  }

  if (screen === 'onboarding') {
    return (
      <div className="ob">
        <div className="obs">
          <div className={`osl ${obSlide === 0 ? 'active' : obSlide > 0 ? 'prev' : 'next'}`}>
            <div className="oi s1">🧺</div>
            <div className="ott">Schedule in a swipe</div>
            <div className="otd">Pick a service, date & time. We&apos;ll pick up and deliver.</div>
          </div>
          <div className={`osl ${obSlide === 1 ? 'active' : obSlide > 1 ? 'prev' : 'next'}`}>
            <div className="oi s2">📅</div>
            <div className="ott">Tue & Sat pickups</div>
            <div className="otd">Campus pickups. Afternoon slot for your convenience.</div>
          </div>
          <div className={`osl ${obSlide === 2 ? 'active' : obSlide < 2 ? 'next' : 'prev'}`}>
            <div className="oi s3">✨</div>
            <div className="ott">Track & relax</div>
            <div className="otd">Get token and status updates. One less thing to worry about.</div>
          </div>
        </div>
        <div className="obt">
          <div className="ods">
            {([0, 1, 2] as const).map((i) => (
              <div key={i} className={`od ${obSlide === i ? 'a' : ''}`} />
            ))}
          </div>
          <button type="button" className="btn bp bbl" onClick={handleObNext}>
            {obSlide < 2 ? 'Next' : 'Get Started'}
          </button>
          <button type="button" className="btn bout bbl" onClick={handleObSkip}>
            Skip
          </button>
          <div className="ob-legal">
            <Link href="/privacy">Privacy</Link>
            {' · '}
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    );
  }

  const isStudentSignup = studentCid && studentCid !== 'general';

  useEffect(() => {
    if (screen === 'complete-profile' && user) {
      setSignupPh(user.ph ?? '');
      setSignupWa(user.wa ?? '');
      setStudentCid(user.cid ?? 'general');
      setStudentRn(user.rn ?? '');
      setStudentHos(user.hos ?? '');
      setStudentYr(user.yr != null ? String(user.yr) : '');
    }
  }, [screen, user?.sid]);

  useEffect(() => {
    if (screen === 'my-bills' && user?.sid) {
      setMyBillsLoading(true);
      LSApi.fetchVendorBillsForUser(user.sid).then((data) => {
        setMyBills(data ?? []);
        setMyBillsLoading(false);
      });
    }
  }, [screen, user?.sid]);

  if (screen === 'login') {
    return (
      <div className="as">
        <div className="ah">
          <div className="lg">
            <div className="lgi">🧺</div>
            <span className="lgt">LaundroSwipe</span>
          </div>
          <h1 className="atl">Sign in</h1>
          <p className="asu">Use your account to schedule pickups</p>
        </div>
        {LSApi.hasSupabase && (
          <button type="button" className="btn bp bbl" onClick={handleGoogleLogin} disabled={authLoading}>
            Continue with Google
          </button>
        )}
        <form onSubmit={handleLoginEmail} style={{ marginTop: LSApi.hasSupabase ? 16 : 0 }}>
          <div className="fg">
            <label className="fl">Email</label>
            <input
              type="email"
              className="fi"
              placeholder="you@example.com"
              value={loginEm}
              onChange={(e) => setLoginEm(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="fg">
            <label className="fl">Password</label>
            <input
              type="password"
              className="fi"
              placeholder="••••••••"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn bout bbl" disabled={authLoading}>
            {authLoading ? 'Signing in…' : 'Sign in with email'}
          </button>
        </form>
        <p className="aft" style={{ marginTop: 24, fontWeight: 600, color: 'var(--tx)' }}>
          New here? Create an account
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn bout bbl" onClick={() => go('signup')}>
            Sign up
          </button>
        </div>
        <p className="aft legal" style={{ marginTop: 20 }}>
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </p>
      </div>
    );
  }

  if (screen === 'complete-profile') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Complete your profile</h1>
          <p className="asu">We need your details for orders & updates. Phone and WhatsApp must be 10-digit Indian numbers.</p>
        </div>
        <form onSubmit={handleCompleteProfile}>
          <div className="fg">
            <label className="fl">Full name</label>
            <input type="text" className="fi" value={user?.fn ?? ''} readOnly style={{ background: 'var(--bg)', color: 'var(--ts)' }} />
          </div>
          <div className="fg">
            <label className="fl">Email</label>
            <input type="email" className="fi" value={user?.em ?? ''} readOnly style={{ background: 'var(--bg)', color: 'var(--ts)' }} />
          </div>
          <div className="fg">
            <label className="fl">Phone</label>
            <input type="tel" className="fi" placeholder="10-digit mobile number" value={signupPh} onChange={(e) => { setSignupPh(e.target.value); setSignupPhErr(''); }} required />
            {signupPhErr && <p className="field-error">{signupPhErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">WhatsApp</label>
            <input type="tel" className="fi" placeholder="10-digit WhatsApp number" value={signupWa} onChange={(e) => { setSignupWa(e.target.value); setSignupWaErr(''); }} required />
            {signupWaErr && <p className="field-error">{signupWaErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">College</label>
            <select className="fi fs" value={studentCid} onChange={(e) => setStudentCid(e.target.value)} required>
              <option value="">Select one</option>
              <option value="general">Not a student</option>
              {COLLEGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{!c.active ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>
          {isStudentSignup && (
            <>
              <div className="fg">
                <label className="fl">Registration number</label>
                <input type="text" className="fi" placeholder="Reg no" value={studentRn} onChange={(e) => setStudentRn(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Hostel block (optional)</label>
                <input type="text" className="fi" placeholder="Block / room" value={studentHos} onChange={(e) => setStudentHos(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Year (optional)</label>
                <input type="number" className="fi" placeholder="e.g. 2" min={1} max={5} value={studentYr} onChange={(e) => setStudentYr(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn bp bbl" disabled={authLoading}>
            {authLoading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

  if (screen === 'signup' || screen === 'student-signup') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Create account</h1>
          <p className="asu">Students: pick your college. Not a student? Choose &quot;Not a student&quot; below.</p>
        </div>
        <form onSubmit={handleSignup}>
          <div className="fg">
            <label className="fl">Full name</label>
            <input type="text" className="fi" placeholder="Your name" value={signupFn} onChange={(e) => setSignupFn(e.target.value)} required />
          </div>
          <div className="fg">
            <label className="fl">Email</label>
            <input type="email" className="fi" placeholder="you@example.com" value={signupEm} onChange={(e) => setSignupEm(e.target.value)} required />
          </div>
          <div className="fg">
            <label className="fl">Phone</label>
            <input type="tel" className="fi" placeholder="10-digit mobile number" value={signupPh} onChange={(e) => { setSignupPh(e.target.value); setSignupPhErr(''); }} required />
            {signupPhErr && <p className="field-error">{signupPhErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">WhatsApp</label>
            <input type="tel" className="fi" placeholder="10-digit WhatsApp number" value={signupWa} onChange={(e) => { setSignupWa(e.target.value); setSignupWaErr(''); }} required />
            {signupWaErr && <p className="field-error">{signupWaErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">College</label>
            <select className="fi fs" value={studentCid} onChange={(e) => setStudentCid(e.target.value)} required>
              <option value="">Select one</option>
              <option value="general">Not a student</option>
              {COLLEGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{!c.active ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>
          {isStudentSignup && (
            <>
              <div className="fg">
                <label className="fl">Registration number</label>
                <input type="text" className="fi" placeholder="Reg no" value={studentRn} onChange={(e) => setStudentRn(e.target.value)} required />
              </div>
              <div className="fg">
                <label className="fl">Hostel block (optional)</label>
                <input type="text" className="fi" placeholder="Block / room" value={studentHos} onChange={(e) => setStudentHos(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Year (optional)</label>
                <input type="number" className="fi" placeholder="e.g. 2" min={1} max={5} value={studentYr} onChange={(e) => setStudentYr(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn bp bbl" disabled={authLoading}>
            {authLoading ? 'Creating…' : 'Sign up'}
          </button>
        </form>
        <p className="aft">
          Already have an account?{' '}
          <span className="al" onClick={() => go('login')} role="button">
            Sign in
          </span>
        </p>
      </div>
    );
  }

  if (screen === 'token-success') {
    const order = orders.find((o) => o.id === dd.oid) ?? orders[0];
    return (
      <div className="as si token-success-page">
        <div className="vc token-success-card">
          <div className="vn" style={{ fontSize: 20, marginBottom: 8 }}>Order confirmed</div>
          <div className="vd" style={{ marginBottom: 20 }}>Show this token at pickup</div>
          {order && (
            <div className="tnb token-display">
              <div className="token-label">YOUR TOKEN NUMBER</div>
              <div className="token-value">#{order.tk}</div>
            </div>
          )}
          {order && (
            <div className="token-order-info">
              <div className="vd"><strong>Order:</strong> {order.on}</div>
              <div className="vd"><strong>Service:</strong> {order.sl} · {order.pd} · {order.ts}</div>
            </div>
          )}
          <ul className="tkins">
            <li>Keep this token handy for pickup</li>
            <li>We&apos;ll notify you on WhatsApp</li>
          </ul>
        </div>
        <button type="button" className="btn bp bbl" onClick={() => go('home')}>
          Back to Home
        </button>
      </div>
    );
  }

  if (screen === 'coming-soon') {
    return (
      <div className="as si">
        <div className="csw" />
        <div className="csb" />
        <div className="csb" />
        <div className="csb" />
        <h2 className="st" style={{ marginTop: 120 }}>Coming soon</h2>
        <p className="fn">This feature is under construction.</p>
        <button type="button" className="btn bp bbl" onClick={() => go('home')}>
          Back
        </button>
      </div>
    );
  }

  const tab = screen === 'order-detail' ? 'orders' : screen === 'my-bills' ? 'profile' : screen === 'home' ? 'home' : screen === 'schedule' ? 'schedule' : screen === 'orders' ? 'orders' : 'profile';
  const showMain = ['home', 'schedule', 'orders', 'profile', 'order-detail', 'my-bills'].includes(screen);

  if (showMain && user) {
    return (
      <>
        <header className="tn">
          <h1>LaundroSwipe</h1>
        </header>
        <main className="scr">
          <div className="si">
            {screen === 'home' && (
              <>
                <div className="hh">
                  <p style={{ marginBottom: 8 }}>Hi, {user.fn} 👋</p>
                  <p style={{ opacity: 0.9, fontSize: 14 }}>Schedule a pickup or check your orders.</p>
                  <button type="button" className="scta" onClick={() => go('schedule')}>
                    Schedule pickup
                    <span className="aw">→</span>
                  </button>
                </div>
                <p className="st">Services</p>
                <div className="sg">
                  {SERVICES.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className="sc"
                      onClick={() => go('schedule')}
                    >
                      <span className="ic">{s.emoji}</span>
                      <span className="nm">{s.name}</span>
                    </button>
                  ))}
                </div>
                <div className="hiw">
                  <div className="hiws">
                    <div className="hiwn">1</div>
                    <div className="hiwt">Pick service & date</div>
                  </div>
                  <div className="hiws">
                    <div className="hiwn">2</div>
                    <div className="hiwt">We pick up</div>
                  </div>
                  <div className="hiws">
                    <div className="hiwn">3</div>
                    <div className="hiwt">Delivery</div>
                  </div>
                </div>
                {orders.length > 0 && (
                  <>
                    <p className="st">Recent orders</p>
                    {orders.slice(0, 3).map((o) => (
                      <div
                        key={o.id}
                        className="oc"
                        onClick={() => go('order-detail', { oid: o.id })}
                        onKeyDown={(e) => e.key === 'Enter' && go('order-detail', { oid: o.id })}
                        role="button"
                        tabIndex={0}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="aotkv">#{o.tk}</span>
                          <span className={`vdb ${statusClass(o.status)}`}>{statusLabel(o.status)}</span>
                        </div>
                        <div className="vd">{o.sl} · {o.pd}</div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {screen === 'schedule' && (
              <>
                <div className="spi">
                  <div className={`spd ${sd.step >= 1 ? 'ac' : ''} ${sd.step > 1 ? 'dn' : ''}`}>1</div>
                  <div className={`spl ${sd.step > 1 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 2 ? 'ac' : ''} ${sd.step > 2 ? 'dn' : ''}`}>2</div>
                  <div className={`spl ${sd.step > 2 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 3 ? 'ac' : ''} ${sd.step > 2 ? 'dn' : ''}`}>3</div>
                </div>
                {sd.step === 1 && (
                  <>
                    <p className="st">Choose service</p>
                    {SERVICES.map((s) => (
                      <div
                        key={s.id}
                        className={`ssc ${sd.svc === s.id ? 'sel' : ''}`}
                        onClick={() => handleScheduleService(s.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleScheduleService(s.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="em">{s.emoji}</span>
                        <div className="inf">
                          <div className="sn">{s.name}</div>
                          <div className="sd">{s.desc}</div>
                        </div>
                        <div className="rd" />
                      </div>
                    ))}
                    <button type="button" className="btn bout bbl" style={{ marginTop: 16 }} onClick={() => go('home')}>
                      Back
                    </button>
                  </>
                )}
                {sd.step === 2 && (
                  <>
                    <p className="st">Pick date (Tue / Sat)</p>
                    <div className="dss">
                      {days.map((d) => (
                        <button
                          type="button"
                          key={d.full}
                          className={`ds ${sd.date === d.full ? 'sel' : ''}`}
                          onClick={() => setSd((s) => ({ ...s, date: d.full }))}
                        >
                          <span className="dy">{d.day}</span>
                          <div className="dn2">{d.num}</div>
                          <span className="mo">{d.month}</span>
                        </button>
                      ))}
                    </div>
                    <p className="st" style={{ marginTop: 20 }}>Time slot</p>
                    {TIME_SLOTS.map((t) => (
                      <div
                        key={t.id}
                        className={`ts2 ${sd.ts === t.id ? 'sel' : ''}`}
                        onClick={() => setSd((s) => ({ ...s, ts: t.id }))}
                        onKeyDown={(e) => e.key === 'Enter' && setSd((s) => ({ ...s, ts: t.id }))}
                        role="button"
                        tabIndex={0}
                      >
                        <span>{t.emoji}</span>
                        <span>{t.label}</span>
                      </div>
                    ))}
                    <div className="fg" style={{ marginTop: 16 }}>
                      <label className="fl">Instructions (optional)</label>
                      <textarea
                        className="fi fta"
                        placeholder="e.g. Leave at guard"
                        value={sd.ins ?? ''}
                        onChange={(e) => setSd((s) => ({ ...s, ins: e.target.value }))}
                      />
                    </div>
                    <button type="button" className="btn bp bbl" style={{ marginTop: 8 }} onClick={() => sd.date && sd.ts && handleScheduleDateSlot(sd.date, sd.ts, sd.ins ?? '')} disabled={!sd.date || !sd.ts}>
                      Continue
                    </button>
                    <button type="button" className="btn bout bbl" style={{ marginTop: 8 }} onClick={() => setSd((s) => ({ ...s, step: 1 }))}>
                      Back
                    </button>
                  </>
                )}
                {sd.step === 3 && (
                  <>
                    <p className="st">Confirm</p>
                    <div className="vc">
                      <div className="vn">{selectedSvc?.name} {selectedSvc?.emoji}</div>
                      <div className="vd">{sd.date} · {selectedTs?.label}</div>
                      {sd.ins && <div className="vd">Instructions: {sd.ins}</div>}
                    </div>
                    <div className="warn">
                      Pickup at {VENDOR.location} on {sd.date}. Keep your token ready.
                    </div>
                    <button type="button" className="btn bp bbl" onClick={handleConfirmOrder} disabled={orderSubmitting}>
                      {orderSubmitting ? 'Placing…' : 'Confirm order'}
                    </button>
                    <button type="button" className="btn bout bbl" style={{ marginTop: 8 }} onClick={() => setSd((s) => ({ ...s, step: 2 }))}>
                      Back
                    </button>
                  </>
                )}
              </>
            )}

            {screen === 'orders' && (
              <>
                <p className="st">Your orders</p>
                {orders.length === 0 ? (
                  <p className="fn">No orders yet. Schedule a pickup from Home.</p>
                ) : (
                  orders.map((o) => (
                    <div
                      key={o.id}
                      className="oc"
                      onClick={() => go('order-detail', { oid: o.id })}
                      onKeyDown={(e) => e.key === 'Enter' && go('order-detail', { oid: o.id })}
                      role="button"
                      tabIndex={0}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="aotkv">#{o.tk}</span>
                        <span className={`vdb ${statusClass(o.status)}`}>{statusLabel(o.status)}</span>
                      </div>
                      <div className="vd">{o.sl} · {o.pd} · {o.ts}</div>
                    </div>
                  ))
                )}
              </>
            )}

            {screen === 'order-detail' && (() => {
              const order = orders.find((o) => o.id === dd.oid);
              if (!order) return <p className="fn">Order not found.</p>;
              const canConfirmDelivery = order.status === 'delivered' && !order.deliveryConfirmedAt;
              return (
                <>
                  <div className="vc">
                    <div className="vn">Token #{order.tk}</div>
                    <div className="vd">{order.sl}</div>
                    <div className="vd">{order.pd} · {order.ts}</div>
                    <div className="vds">
                      <span className={`vdb ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>
                    </div>
                    {order.ins && <div className="vd">Instructions: {order.ins}</div>}
                  </div>
                  {(order.status === 'delivered' || order.deliveryConfirmedAt) && (
                    <div className="vc" style={{ background: '#DCFCE7', borderColor: 'rgba(22,163,74,.2)' }}>
                      {order.deliveryConfirmedAt ? (
                        <div className="vd">✓ You confirmed you received all items.{order.deliveryComments && ` "${order.deliveryComments}"`}</div>
                      ) : (
                        <>
                          <div className="vn" style={{ fontSize: 15 }}>Confirm you got all items</div>
                          <div className="vd" style={{ marginBottom: 12 }}>Mark that you collected your clothes.</div>
                          <textarea
                            placeholder="Optional comments"
                            className="fi fta"
                            value={deliveryComments}
                            onChange={(e) => setDeliveryComments(e.target.value)}
                            rows={2}
                            style={{ marginBottom: 12 }}
                          />
                          <button type="button" className="btn bp bbl" disabled={confirmingDelivery} onClick={() => handleConfirmDelivery(order.id)}>
                            {confirmingDelivery ? 'Submitting…' : 'Submit confirmation'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {order.status !== 'delivered' && !order.deliveryConfirmedAt && (
                    <div className="vd" style={{ marginBottom: 12 }}>Once delivered, you can confirm here that you received all items.</div>
                  )}
                  <button type="button" className="btn bout bbl" onClick={() => go('orders')}>
                    Back to orders
                  </button>
                </>
              );
            })()}

            {screen === 'my-bills' && (
              <>
                <button type="button" className="btn bout bsm" style={{ marginBottom: 12 }} onClick={() => go('profile')}>
                  ← Back to profile
                </button>
                <p className="st">My bills</p>
                <p className="vd" style={{ marginBottom: 16 }}>Bills generated for your orders.</p>
                {myBillsLoading ? (
                  <p className="vd">Loading…</p>
                ) : myBills.length === 0 ? (
                  <p className="vd">No bills yet. Bills appear here after a vendor generates one for your order.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {myBills.map((b) => (
                      <div key={b.id} className="oc" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                        <div style={{ fontWeight: 700, color: 'var(--b)' }}>Token #{b.order_token} · {b.order_number ?? '—'}</div>
                        <div style={{ fontSize: 13, color: 'var(--ts)' }}>₹{b.total} · {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn bout bbl" style={{ flex: 1 }} onClick={() => { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill #${b.order_token}</title><style>body{font-family:system-ui;padding:16px}table{width:100%;border-collapse:collapse}.right{text-align:right}.total{font-weight:700;border-top:2px solid #000;padding-top:8px;margin-top:8px}</style></head><body><h2>LaundroSwipe</h2><p><strong>Token:</strong> #${b.order_token} &nbsp; <strong>Order:</strong> ${b.order_number ?? '—'}</p><p><strong>Customer:</strong> ${b.customer_name ?? '—'}</p><p><strong>Phone:</strong> ${b.customer_phone ?? '—'}</p><p><strong>Date:</strong> ${b.created_at ? new Date(b.created_at).toLocaleString() : ''}</p><table><thead><tr><th>Item</th><th class="right">₹</th></tr></thead><tbody>${(b.line_items || []).map((l: { label: string; qty: number; price: number }) => `<tr><td>${l.label} x${l.qty}</td><td class="right">₹${l.price * l.qty}</td></tr>`).join('')}</tbody></table><p class="right">Subtotal: ₹${b.subtotal}</p><p class="right">Convenience fee: ₹${b.convenience_fee}</p><p class="total right">Total: ₹${b.total}</p></body></html>`); w.document.close(); }}>
                            View bill
                          </button>
                          <button type="button" className="btn bp bbl" style={{ flex: 1 }} onClick={() => { const html = (b.line_items || []).map((l: { label: string; qty: number; price: number }) => `<tr><td>${l.label} x${l.qty}</td><td class="right">₹${l.price * l.qty}</td></tr>`).join(''); const w = window.open('', '_blank'); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill #${b.order_token}</title><style>body{font-family:system-ui;font-size:11px;padding:8px}table{width:100%;border-collapse:collapse}.right{text-align:right}.total{font-weight:700;font-size:12px;border-top:2px solid #000;padding-top:4px;margin-top:4px}</style></head><body><h2>LaundroSwipe</h2><p><strong>Token:</strong> #${b.order_token}</p><p><strong>Order:</strong> ${b.order_number ?? '—'}</p><p><strong>Customer:</strong> ${b.customer_name ?? '—'}</p><table><thead><tr><th>Item</th><th class="right">₹</th></tr></thead><tbody>${html}</tbody></table><p class="right">Subtotal: ₹${b.subtotal}</p><p class="right">Convenience fee: ₹${b.convenience_fee}</p><p class="total right">Total: ₹${b.total}</p></body></html>`); w.document.close(); w.focus(); w.print(); setTimeout(() => w.close(), 500); }}>
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {screen === 'profile' && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div className="pa">{user.fn.charAt(0).toUpperCase()}</div>
                  <p className="st" style={{ marginTop: 8 }}>{user.fn}</p>
                  <p className="vd">{user.em}</p>
                  {user.ph && <p className="vd">{user.ph}</p>}
                </div>
                <div className="pmi" onClick={() => go('my-bills')}>
                  <div className="pmic bl2">🧾</div>
                  <span>My bills</span>
                </div>
                <div className="pmi" onClick={() => go('coming-soon')}>
                  <div className="pmic bl2">📋</div>
                  <span>Edit profile</span>
                </div>
                <div className="pmi" onClick={() => go('coming-soon')}>
                  <div className="pmic tl3">🔔</div>
                  <span>Notifications</span>
                </div>
                <button type="button" className="btn bout bbl" style={{ marginTop: 24 }} onClick={handleLogout}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </main>
        <nav className="bn">
          <button type="button" className={`ni ${tab === 'home' ? 'a' : ''}`} onClick={() => go('home')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            Home
          </button>
          <button type="button" className={`ni ct ${tab === 'schedule' ? 'a' : ''}`} onClick={() => { setSd({ step: 1 }); go('schedule'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            Schedule
          </button>
          <button type="button" className={`ni ${tab === 'orders' ? 'a' : ''}`} onClick={() => go('orders')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            Orders
          </button>
          <button type="button" className={`ni ${tab === 'profile' ? 'a' : ''}`} onClick={() => go('profile')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Profile
          </button>
        </nav>
        {toast && (
          <div className={`toast ${toast.type ?? ''}`}>
            {toast.msg}
          </div>
        )}
      </>
    );
  }

  return null;
}
