'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  COLLEGES,
  SERVICES,
  VENDORS,
  VENDOR,
  statusLabel,
  statusClass,
  getScheduleDates,
  isEveningOnlyDate,
} from '@/lib/constants';
import { LSApi } from '@/lib/api';
import type { UserRow, VendorBillRow, ScheduleSlotRow, ScheduleDateRow, UserNotificationRow } from '@/lib/api';
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
  | 'coming-soon'
  | 'edit-profile'
  | 'notifications'
  | 'forgot-password'
  | 'set-password';

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
  vendorId?: string;
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
  { id: 'evening', label: 'Evening (4:45–5:45 PM)', emoji: '🌆' },
];

function formatScheduleDay(full: string): { date: Date; day: string; num: number; month: string; ok: boolean; full: string } {
  const d = new Date(full + 'T12:00:00');
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    date: d,
    day: dn[d.getDay()],
    num: d.getDate(),
    month: mn[d.getMonth()],
    ok: true,
    full,
  };
}


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
  const [forgotEm, setForgotEm] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deliveryComments, setDeliveryComments] = useState('');
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [myBills, setMyBills] = useState<VendorBillRow[]>([]);
  const [myBillsLoading, setMyBillsLoading] = useState(false);
  const [viewingBill, setViewingBill] = useState<VendorBillRow | null>(null);
  const [profilePw, setProfilePw] = useState('');
  const [profilePwConfirm, setProfilePwConfirm] = useState('');
  const [profilePwSaving, setProfilePwSaving] = useState(false);
  const [editFn, setEditFn] = useState('');
  const [editPh, setEditPh] = useState('');
  const [editWa, setEditWa] = useState('');
  const [editCid, setEditCid] = useState('general');
  const [editRn, setEditRn] = useState('');
  const [editHos, setEditHos] = useState('');
  const [editYr, setEditYr] = useState('');
  const [editPhErr, setEditPhErr] = useState('');
  const [editWaErr, setEditWaErr] = useState('');
  const [editProfileSaving, setEditProfileSaving] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlotRow[]>([]);
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateRow[]>([]);
  const [scheduleConfigLoaded, setScheduleConfigLoaded] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement>(null);

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
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const digits = String(Math.floor(100 + Math.random() * 900)); // 100–999
    return letter + digits; // e.g. A704
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

    const hasAuthHash = typeof window !== 'undefined' && !!window.location.hash && /access_token|refresh_token/.test(window.location.hash);
    const t = setTimeout(() => {
      if (!mounted) return;
      if (screen === 'splash') {
        if (restoredUser) setScreen('home');
        else if (hasAuthHash) { /* stay on splash; init() will set complete-profile or home */ }
        else setScreen(lsOb ? 'login' : 'onboarding');
      }
    }, 900);

    async function tryApplySession(session: { user: unknown } | null) {
      if (!mounted || !session?.user) return false;
      let profile = await LSApi.upsertUserFromAuth(session.user as { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string } });
      if (!profile) return false;
      if (!profile.phone?.trim()) {
        const refetched = await LSApi.fetchUserById(profile.id);
        if (refetched?.phone?.trim()) profile = refetched;
      }
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
        setSignupPh(profile.phone ?? '');
        setSignupWa(profile.whatsapp ?? '');
        setStudentCid(profile.college_id ?? 'general');
        setStudentRn(profile.reg_no ?? '');
        setStudentHos(profile.hostel_block ?? '');
        setStudentYr(profile.year != null ? String(profile.year) : '');
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
        const isRecovery = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash || '');
        if (isRecovery) {
          setScreen('set-password');
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          return;
        }
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
            const isRecovery = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash || '');
            if (isRecovery) {
              setScreen('set-password');
              if (typeof window !== 'undefined' && window.history?.replaceState) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
              return;
            }
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

  useEffect(() => {
    if (screen === 'my-bills' && user?.sid) {
      setMyBillsLoading(true);
      LSApi.fetchVendorBillsForUser(user.sid).then((data) => {
        setMyBills(data ?? []);
        setMyBillsLoading(false);
      });
    }
  }, [screen, user?.sid]);

  // Refetch orders when user views Orders or order-detail so vendor status updates (picked_up, delivered) show
  useEffect(() => {
    if ((screen === 'orders' || screen === 'order-detail') && user?.sid) {
      LSApi.fetchOrdersForUser(user.sid).then((ords) => {
        if (ords && ords.length >= 0) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
      });
    }
  }, [screen, user?.sid, saveO]);

  // Load schedule config (dates + slots) when user opens schedule flow
  useEffect(() => {
    if (screen !== 'schedule' || !LSApi.hasSupabase || scheduleConfigLoaded) return;
    Promise.all([LSApi.fetchScheduleSlots(), LSApi.fetchScheduleDates()]).then(([slots, dates]) => {
      if (slots?.length) setScheduleSlots(slots);
      if (dates?.length) setScheduleDates(dates);
      setScheduleConfigLoaded(true);
    });
  }, [screen, scheduleConfigLoaded]);

  useEffect(() => {
    if (screen !== 'schedule' || sd.step !== 3) return;
    const onMouseMove = (e: MouseEvent) => {
      if (swipeStartRef.current) {
        const start = swipeStartRef.current;
        const p = Math.max(0, Math.min(100, ((e.clientX - start.left) / start.width) * 100));
        swipeProgressRef.current = p;
        setSwipeProgress(p);
      }
    };
    const onMouseUp = () => {
      if (swipeStartRef.current) {
        const progress = swipeProgressRef.current;
        swipeStartRef.current = null;
        if (progress >= 80) handleConfirmOrderRef.current();
        setSwipeProgress(0);
        swipeProgressRef.current = 0;
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [screen, sd.step]);

  // Non-passive touch on swipe track so we can preventDefault and stop back/scroll
  useEffect(() => {
    const track = swipeTrackRef.current;
    if (!track) return;
    const onTouchMove = (e: TouchEvent) => {
      if (swipeStartRef.current) {
        e.preventDefault();
        const start = swipeStartRef.current;
        const clientX = e.touches[0].clientX;
        const p = Math.max(0, Math.min(100, ((clientX - start.left) / start.width) * 100));
        swipeProgressRef.current = p;
        setSwipeProgress(p);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (swipeStartRef.current) {
        e.preventDefault();
        const progress = swipeProgressRef.current;
        swipeStartRef.current = null;
        if (progress >= 80) handleConfirmOrderRef.current();
        setSwipeProgress(0);
        swipeProgressRef.current = 0;
      }
    };
    track.addEventListener('touchmove', onTouchMove, { passive: false });
    track.addEventListener('touchend', onTouchEnd, { passive: false });
    track.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      track.removeEventListener('touchmove', onTouchMove);
      track.removeEventListener('touchend', onTouchEnd);
      track.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [screen, sd.step]);

  // Once logged in, never show login again — redirect to home
  useEffect(() => {
    if (screen === 'login' && user) go('home');
  }, [screen, user, go]);

  // Prefill edit profile form when opening
  useEffect(() => {
    if (screen === 'edit-profile' && user) {
      setEditFn(user.fn ?? '');
      setEditPh(user.ph ?? '');
      setEditWa(user.wa ?? '');
      setEditCid(user.cid ?? 'general');
      setEditRn(user.rn ?? '');
      setEditHos(user.hos ?? '');
      setEditYr(user.yr != null ? String(user.yr) : '');
      setEditPhErr('');
      setEditWaErr('');
    }
  }, [screen, user]);

  // Load notifications when opening notifications screen
  useEffect(() => {
    if (screen !== 'notifications' || !LSApi.hasSupabase) return;
    setNotificationsLoading(true);
    LSApi.fetchNotifications()
      .then((list) => {
        if (list) setNotifications(list);
        else setNotifications([]);
      })
      .finally(() => setNotificationsLoading(false));
  }, [screen]);

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
      showToast('Enter your email', 'er');
      return;
    }
    if (!loginPw) {
      showToast('Enter your password', 'er');
      return;
    }
    if (!LSApi.hasSupabase) {
      showToast('Service unavailable. Configure Supabase (see deployment).', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const { user: profile, error } = await LSApi.signInWithPassword(loginEm.trim(), loginPw);
      if (profile) {
        const u = rowToUser(profile);
        setUser(u);
        saveUser(u);
        const ords = await LSApi.fetchOrdersForUser(profile.id);
        if (ords) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
        go('home');
        showToast('Welcome back!', 'ok');
      } else {
        showToast(error || 'Invalid email or password', 'er');
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEm.trim();
    if (!email) {
      showToast('Enter your email', 'er');
      return;
    }
    if (!LSApi.hasSupabase) {
      showToast('Service unavailable.', 'er');
      return;
    }
    setAuthLoading(true);
    const { error } = await LSApi.resetPasswordForEmail(email);
    setAuthLoading(false);
    if (error) {
      showToast(error, 'er');
      return;
    }
    setResetSent(true);
    showToast('Check your email for a reset link', 'ok');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'er');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showToast('Passwords do not match', 'er');
      return;
    }
    if (!LSApi.hasSupabase) {
      showToast('Service unavailable.', 'er');
      return;
    }
    setAuthLoading(true);
    const { error } = await LSApi.updatePassword(newPassword);
    setAuthLoading(false);
    if (error) {
      showToast(error, 'er');
      return;
    }
    showToast('Password updated. Signing you in…', 'ok');
    const session = await LSApi.getAuthSession();
    if (session?.user) {
      let profile = await LSApi.upsertUserFromAuth(session.user as { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string } });
      if (profile && !profile.phone?.trim()) {
        const refetched = await LSApi.fetchUserById(profile.id);
        if (refetched?.phone?.trim()) profile = refetched;
      }
      if (profile) {
        const u = rowToUser(profile);
        setUser(u);
        saveUser(u);
        const needsProfile = !profile.phone?.trim();
        if (needsProfile) {
          setSignupPh(profile.phone ?? '');
          setSignupWa(profile.whatsapp ?? '');
          setStudentCid(profile.college_id ?? 'general');
          setStudentRn(profile.reg_no ?? '');
          setStudentHos(profile.hostel_block ?? '');
          setStudentYr(profile.year != null ? String(profile.year) : '');
          setScreen('complete-profile');
        } else {
          setScreen('home');
        }
      } else {
        setScreen('login');
      }
    } else {
      setScreen('login');
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
    if (!signupPw || signupPw.length < 6) {
      showToast('Please enter a password (at least 6 characters) to sign in with email later', 'er');
      return;
    }
    const isGeneral = !studentCid || studentCid === 'general';
    if (!isGeneral && !studentRn.trim()) {
      showToast('Registration number required for students', 'er');
      return;
    }
    setAuthLoading(true);
    try {
      const { user: row, error } = await LSApi.signUpWithEmail(
        signupEm.trim(),
        signupPw,
        {
          full_name: signupFn.trim(),
          phone: signupPh.trim(),
          whatsapp: signupWa.trim(),
          user_type: isGeneral ? 'general' : 'student',
          college_id: isGeneral ? null : studentCid,
          reg_no: isGeneral ? null : studentRn.trim() || null,
          hostel_block: studentHos.trim() || null,
          year: studentYr?.trim() ? parseInt(studentYr, 10) || null : null,
        }
      );
      if (row) {
        const u = rowToUser(row);
        setUser(u);
        saveUser(u);
        const ords = await LSApi.fetchOrdersForUser(row.id);
        if (ords) {
          const mapped = ords.map(rowToOrder);
          setOrders(mapped);
          saveO(mapped);
        }
        go('home');
        showToast('Account created. You can sign in with email + password anytime.', 'ok');
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
      const yearNum = studentYr?.trim() ? parseInt(studentYr, 10) : null;
      const { user: updated, error } = await LSApi.updateUser(user.sid, {
        phone: signupPh.trim(),
        whatsapp: signupWa.trim(),
        user_type: isGeneral ? 'general' : 'student',
        college_id: isGeneral ? null : studentCid,
        reg_no: isGeneral ? null : studentRn.trim() || null,
        hostel_block: studentHos.trim() || null,
        year: yearNum != null && !Number.isNaN(yearNum) ? yearNum : null,
      });
      if (updated) {
        const u = rowToUser(updated);
        setUser(u);
        saveUser(u);
        go('home');
        showToast('Profile complete', 'ok');
      } else {
        showToast(error || 'Update failed', 'er');
      }
    } catch (_) {
      showToast('Update failed', 'er');
    }
    setAuthLoading(false);
  };

  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditPhErr('');
    setEditWaErr('');
    const phCheck = validateIndianPhone(editPh.trim());
    const waCheck = validateIndianPhone(editWa.trim());
    if (!phCheck.valid) {
      setEditPhErr(phCheck.message ?? 'Invalid phone');
      return;
    }
    if (!waCheck.valid) {
      setEditWaErr(waCheck.message ?? 'Invalid WhatsApp');
      return;
    }
    if (!user?.sid) return;
    const isGeneral = !editCid || editCid === 'general';
    if (!isGeneral && !editRn.trim()) {
      showToast('Registration number required for students', 'er');
      return;
    }
    setEditProfileSaving(true);
    try {
      const yearNum = editYr?.trim() ? parseInt(editYr, 10) : null;
      const { user: updated, error } = await LSApi.updateUser(user.sid, {
        full_name: editFn.trim() || undefined,
        phone: editPh.trim(),
        whatsapp: editWa.trim(),
        user_type: isGeneral ? 'general' : 'student',
        college_id: isGeneral ? null : editCid,
        reg_no: isGeneral ? null : editRn.trim() || null,
        hostel_block: editHos.trim() || null,
        year: yearNum != null && !Number.isNaN(yearNum) ? yearNum : null,
      });
      if (updated) {
        const u = rowToUser(updated);
        setUser(u);
        saveUser(u);
        go('profile');
        showToast('Profile updated', 'ok');
      } else {
        showToast(error ?? 'Update failed', 'er');
      }
    } catch (_) {
      showToast('Update failed', 'er');
    }
    setEditProfileSaving(false);
  };

  const handleSelectVendor = (vendorId: string) => {
    setSd((s) => ({ ...s, step: 1, vendorId }));
  };

  const handleScheduleService = (svcId: string) => {
    setSd((s) => ({ ...s, step: 2, svc: svcId }));
  };

  const handleScheduleDateSlot = (date: string, ts: string, ins: string) => {
    setSd((s) => ({ ...s, step: 3, date, ts, ins }));
  };

  const handleConfirmOrder = async () => {
    if (!user || !sd.svc || !sd.date || !sd.ts) return;
    const existingSameDay = orders.some(
      (o) => o.pd === sd.date && o.svc === sd.svc && o.status !== 'delivered'
    );
    if (existingSameDay) {
      const svcName = SERVICES.find((x) => x.id === sd.svc)?.name ?? 'this service';
      showToast(`You already have a ${svcName} order for this date. Complete it first.`, 'er');
      return;
    }
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
        setSd({ step: 0 });
        go('token-success', { oid: row.id });
      } else {
        showToast('Order failed', 'er');
      }
    } catch (_) {
      showToast('Order failed', 'er');
    }
    setOrderSubmitting(false);
  };

  const swipeStartRef = useRef<{ left: number; width: number } | null>(null);
  const swipeProgressRef = useRef(0);
  const handleConfirmOrderRef = useRef(handleConfirmOrder);
  handleConfirmOrderRef.current = handleConfirmOrder;
  const handleSwipeStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const track = swipeTrackRef.current;
    if (!track || orderSubmitting) return;
    if ('touches' in e) e.preventDefault();
    e.stopPropagation();
    const rect = track.getBoundingClientRect();
    swipeStartRef.current = { left: rect.left, width: rect.width };
    setSwipeProgress(0);
    swipeProgressRef.current = 0;
  }, [orderSubmitting]);
  const handleSwipeMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const start = swipeStartRef.current;
    if (!start) return;
    if ('touches' in e) e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const p = Math.max(0, Math.min(100, ((clientX - start.left) / start.width) * 100));
    swipeProgressRef.current = p;
    setSwipeProgress(p);
  }, []);
  const handleSwipeEnd = useCallback((e?: React.TouchEvent | React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      if ('preventDefault' in e) e.preventDefault();
    }
    const progress = swipeProgressRef.current;
    swipeStartRef.current = null;
    if (progress >= 80) handleConfirmOrderRef.current();
    setSwipeProgress(0);
    swipeProgressRef.current = 0;
  }, []);

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

  const handleSetPasswordForEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profilePw.length < 6) {
      showToast('Password must be at least 6 characters', 'er');
      return;
    }
    if (profilePw !== profilePwConfirm) {
      showToast('Passwords do not match', 'er');
      return;
    }
    setProfilePwSaving(true);
    const { error } = await LSApi.updatePassword(profilePw);
    setProfilePwSaving(false);
    if (error) {
      showToast(error, 'er');
      return;
    }
    setProfilePw('');
    setProfilePwConfirm('');
    showToast('Password set. You can now sign in with email + password.', 'ok');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const daysFromApi = scheduleDates
    .filter((d) => d.enabled && d.date >= todayStr)
    .map((d) => formatScheduleDay(d.date));
  const days = daysFromApi.length > 0 ? daysFromApi : getScheduleDates();
  const selectedSvc = SERVICES.find((s) => s.id === sd.svc);
  const timeSlotsForStep2 =
    scheduleSlots.length > 0 && scheduleDates.length > 0 && sd.date
      ? scheduleSlots.filter(
          (s) => s.active && (scheduleDates.find((d) => d.date === sd.date)?.slot_ids ?? []).includes(s.id)
        )
      : TIME_SLOTS;
  const selectedTsFromApi = scheduleSlots.find((t) => t.id === sd.ts);
  const selectedTs = selectedTsFromApi
    ? { id: selectedTsFromApi.id, label: selectedTsFromApi.label, emoji: '🕐' }
    : TIME_SLOTS.find((t) => t.id === sd.ts);
  const afternoonDisabled = !selectedTsFromApi && sd.date ? isEveningOnlyDate(sd.date) : false;

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
            <div className="ott">Tue, Sat & Sun pickups</div>
            <div className="otd">Campus pickups. Afternoon or evening slot for your convenience.</div>
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
            <p className="aft" style={{ marginTop: 6 }}>
              <span className="al" onClick={() => go('forgot-password')} role="button">
                Forgot password?
              </span>
            </p>
            <p className="vd" style={{ marginTop: 4, fontSize: 12 }}>Signed up with Google? Set a password in Profile to sign in with email (same account).</p>
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

  if (screen === 'forgot-password') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Forgot password?</h1>
          <p className="asu">Enter your email and we’ll send you a link to reset your password.</p>
        </div>
        {resetSent ? (
          <>
            <p className="vd" style={{ marginBottom: 16 }}>We’ve sent a link to <strong>{forgotEm}</strong>. Check your inbox and click the link to set a new password.</p>
            <button type="button" className="btn bout bbl" onClick={() => { setResetSent(false); setForgotEm(''); go('login'); }}>
              Back to sign in
            </button>
          </>
        ) : (
          <form onSubmit={handleForgotPassword}>
            <div className="fg">
              <label className="fl">Email</label>
              <input
                type="email"
                className="fi"
                placeholder="you@example.com"
                value={forgotEm}
                onChange={(e) => setForgotEm(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn bout bbl" disabled={authLoading}>
              {authLoading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="aft" style={{ marginTop: 20 }}>
          <span className="al" onClick={() => go('login')} role="button">
            Back to sign in
          </span>
        </p>
      </div>
    );
  }

  if (screen === 'set-password') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Set new password</h1>
          <p className="asu">Choose a new password for your account.</p>
        </div>
        <form onSubmit={handleSetPassword}>
          <div className="fg">
            <label className="fl">New password</label>
            <input
              type="password"
              className="fi"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div className="fg">
            <label className="fl">Confirm password</label>
            <input
              type="password"
              className="fi"
              placeholder="Same as above"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <button type="submit" className="btn bout bbl" disabled={authLoading}>
            {authLoading ? 'Updating…' : 'Update password'}
          </button>
        </form>
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
            <label className="fl">Password (required)</label>
            <input type="password" className="fi" placeholder="Min 6 characters — you’ll use this with email to sign in" value={signupPw} onChange={(e) => setSignupPw(e.target.value)} required minLength={6} autoComplete="new-password" />
            <p className="vd" style={{ marginTop: 4, fontSize: 12 }}>Required to sign in with email after sign out.</p>
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

  if (screen === 'edit-profile') {
    return (
      <div className="as">
        <div className="ah">
          <h1 className="atl">Edit profile</h1>
          <p className="asu">Update your details for orders and updates.</p>
        </div>
        <form onSubmit={handleSaveEditProfile}>
          <div className="fg">
            <label className="fl">Full name</label>
            <input type="text" className="fi" placeholder="Your name" value={editFn} onChange={(e) => setEditFn(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Email</label>
            <input type="email" className="fi" value={user?.em ?? ''} readOnly style={{ background: 'var(--bg)', color: 'var(--ts)' }} />
          </div>
          <div className="fg">
            <label className="fl">Phone</label>
            <input type="tel" className="fi" placeholder="10-digit mobile number" value={editPh} onChange={(e) => { setEditPh(e.target.value); setEditPhErr(''); }} />
            {editPhErr && <p className="field-error">{editPhErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">WhatsApp</label>
            <input type="tel" className="fi" placeholder="10-digit WhatsApp number" value={editWa} onChange={(e) => { setEditWa(e.target.value); setEditWaErr(''); }} />
            {editWaErr && <p className="field-error">{editWaErr}</p>}
          </div>
          <div className="fg">
            <label className="fl">College</label>
            <select className="fi fs" value={editCid} onChange={(e) => setEditCid(e.target.value)}>
              <option value="">Select one</option>
              <option value="general">Not a student</option>
              {COLLEGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{!c.active ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>
          {editCid && editCid !== 'general' && (
            <>
              <div className="fg">
                <label className="fl">Registration number</label>
                <input type="text" className="fi" placeholder="Reg no" value={editRn} onChange={(e) => setEditRn(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Hostel block (optional)</label>
                <input type="text" className="fi" placeholder="Block / room" value={editHos} onChange={(e) => setEditHos(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Year (optional)</label>
                <input type="number" className="fi" placeholder="e.g. 2" min={1} max={5} value={editYr} onChange={(e) => setEditYr(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn bp bbl" disabled={editProfileSaving}>
            {editProfileSaving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn bout bbl" style={{ marginTop: 8 }} onClick={() => go('profile')}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (screen === 'notifications') {
    return (
      <div className="as">
        <div className="ah" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn bout bsm" onClick={() => go('profile')} aria-label="Back">←</button>
          <div>
            <h1 className="atl" style={{ margin: 0 }}>Notifications</h1>
            <p className="asu" style={{ margin: 0 }}>Messages from LaundroSwipe</p>
          </div>
        </div>
        {notificationsLoading ? (
          <p className="vd" style={{ marginTop: 24 }}>Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="vd" style={{ marginTop: 24 }}>No messages yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
            {notifications.map((n) => (
              <li
                key={n.id}
                style={{
                  background: n.read_at ? 'var(--bg)' : 'rgba(23,70,162,.06)',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  border: '1px solid var(--bd)',
                }}
                onClick={() => {
                  if (!n.read_at) LSApi.markNotificationRead(n.id).then(() => setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))));
                }}
              >
                <strong style={{ display: 'block', marginBottom: 4 }}>{n.title}</strong>
                {n.body && <p className="vd" style={{ margin: 0, fontSize: 14 }}>{n.body}</p>}
                <p className="vd" style={{ margin: '6px 0 0', fontSize: 12 }}>{n.sent_at ? new Date(n.sent_at).toLocaleString() : ''}</p>
              </li>
            ))}
          </ul>
        )}
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
                  <p style={{ marginBottom: 8 }}>Hi, {user.fn || 'User'} 👋</p>
                  <p style={{ opacity: 0.9, fontSize: 14 }}>Schedule pickup from your favorite laundry company at ease.</p>
                  <button type="button" className="scta" onClick={() => { setSd({ step: 0 }); go('schedule'); }}>
                    Schedule pickup
                    <span className="aw">→</span>
                  </button>
                </div>
                <p className="st">Services</p>
                <div className="sg">
                  {SERVICES.filter((s) => !s.comingSoon).map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className="sc"
                      onClick={() => { setSd({ step: 0 }); go('schedule'); }}
                    >
                      <span className="ic">{s.emoji}</span>
                      <span className="nm">{s.name}</span>
                    </button>
                  ))}
                </div>
                <p className="fn" style={{ marginTop: 8 }}>LaundroSwipe — schedule pickup from your favorite laundry company in one swipe.</p>
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
                  <div className={`spd ${sd.step >= 0 ? 'ac' : ''} ${sd.step > 0 ? 'dn' : ''}`}>1</div>
                  <div className={`spl ${sd.step > 0 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 1 ? 'ac' : ''} ${sd.step > 1 ? 'dn' : ''}`}>2</div>
                  <div className={`spl ${sd.step > 1 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 2 ? 'ac' : ''} ${sd.step > 2 ? 'dn' : ''}`}>3</div>
                  <div className={`spl ${sd.step > 2 ? 'dn' : ''}`} />
                  <div className={`spd ${sd.step >= 3 ? 'ac' : ''} ${sd.step > 2 ? 'dn' : ''}`}>4</div>
                </div>
                {sd.step === 0 && (
                  <>
                    <p className="st">Select vendor</p>
                    <p className="vd" style={{ marginBottom: 16 }}>Choose your laundry partner for pickup & delivery.</p>
                    {VENDORS.map((v) => (
                      <div
                        key={v.id}
                        className="ssc vendor-card"
                        onClick={() => handleSelectVendor(v.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectVendor(v.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="em">{v.emoji}</span>
                        <div className="inf">
                          <div className="sn">{v.name}</div>
                          <div className="sd">{v.location}</div>
                        </div>
                        <span className="aw" style={{ fontSize: 20 }}>→</span>
                      </div>
                    ))}
                    <button type="button" className="btn bout bbl" style={{ marginTop: 16 }} onClick={() => go('home')}>
                      Back
                    </button>
                  </>
                )}
                {sd.step === 1 && (
                  <>
                    <p className="st">Choose service</p>
                    {SERVICES.map((s) => (
                      <div
                        key={s.id}
                        className={`ssc ${sd.svc === s.id ? 'sel' : ''} ${s.comingSoon ? 'coming-soon' : ''}`}
                        onClick={() => !s.comingSoon && handleScheduleService(s.id)}
                        onKeyDown={(e) => !s.comingSoon && e.key === 'Enter' && handleScheduleService(s.id)}
                        role="button"
                        tabIndex={s.comingSoon ? -1 : 0}
                      >
                        <span className="em">{s.emoji}</span>
                        <div className="inf">
                          <div className="sn">{s.name} {s.comingSoon ? '(Coming soon)' : ''}</div>
                          <div className="sd">{s.desc}</div>
                        </div>
                        {!s.comingSoon && <div className="rd" />}
                      </div>
                    ))}
                    <button type="button" className="btn bout bbl" style={{ marginTop: 16 }} onClick={() => setSd((s) => ({ ...s, step: 0 }))}>
                      Back
                    </button>
                  </>
                )}
                {sd.step === 2 && (
                  <>
                    <p className="st">Pick date</p>
                    {days.length === 0 && <p className="vd" style={{ marginBottom: 12 }}>No dates available. Add and enable dates in admin Schedule.</p>}
                    <div className="dss">
                      {days.map((d) => {
                        return (
                          <button
                            type="button"
                            key={d.full}
                            className={`ds ${sd.date === d.full ? 'sel' : ''}`}
                            onClick={() => {
                              const allowedIds =
                                scheduleDates.length > 0
                                  ? (scheduleDates.find((x) => x.date === d.full)?.slot_ids ?? [])
                                  : isEveningOnlyDate(d.full)
                                    ? ['evening']
                                    : ['afternoon', 'evening'];
                              setSd((s) => ({
                                ...s,
                                date: d.full,
                                ts: allowedIds.includes(s.ts ?? '') ? s.ts : undefined,
                              }));
                            }}
                          >
                            <span className="dy">{d.day}</span>
                            <div className="dn2">{d.num}</div>
                            <span className="mo">{d.month}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="st" style={{ marginTop: 20 }}>Time slot</p>
                    {timeSlotsForStep2.length === 0 && sd.date && <p className="vd" style={{ marginBottom: 8 }}>No slots enabled for this date. Enable slots in admin Schedule.</p>}
                    {timeSlotsForStep2.map((t) => {
                      const slotId = 'id' in t ? t.id : (t as { id: string }).id;
                      const slotLabel = 'label' in t ? t.label : (t as { label: string }).label;
                      const slotEmoji = 'emoji' in t ? (t as { emoji?: string }).emoji : '🕐';
                      const isDisabled = scheduleSlots.length === 0 && slotId === 'afternoon' && isEveningOnlyDate(sd.date);
                      return (
                        <div
                          key={slotId}
                          className={`ts2 ${sd.ts === slotId ? 'sel' : ''} ${isDisabled ? 'ts2-dis' : ''}`}
                          onClick={() => !isDisabled && setSd((s) => ({ ...s, ts: slotId }))}
                          onKeyDown={(e) => !isDisabled && e.key === 'Enter' && setSd((s) => ({ ...s, ts: slotId }))}
                          role="button"
                          tabIndex={isDisabled ? -1 : 0}
                        >
                          <span>{slotEmoji}</span>
                          <span>{slotLabel}{isDisabled ? ' (not available this day)' : ''}</span>
                        </div>
                      );
                    })}
                    <p className="vd" style={{ marginTop: 10, fontSize: 12 }}>Timings may vary.</p>
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
                    <p className="vd" style={{ marginTop: 8, fontSize: 12 }}>Timings may vary.</p>
                    <p className="vd" style={{ marginBottom: 12, fontWeight: 600 }}>Swipe to confirm order →</p>
                    <div
                      className="swipe-wrap"
                      onClick={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <div
                        ref={swipeTrackRef}
                        className="swipe-track"
                        onTouchStart={handleSwipeStart}
                        onMouseDown={handleSwipeStart}
                      >
                        <div className="swipe-fill" style={{ width: `${swipeProgress}%` }} />
                        <div
                          className="swipe-thumb"
                          style={{
                            left: `calc(24px + (100% - 48px) * ${swipeProgress / 100})`,
                            transform: `translateX(-50%) translateZ(12px) scale(${swipeProgress >= 80 ? 1.08 : 1})`,
                            boxShadow: swipeProgress >= 80
                              ? '0 8px 24px rgba(23,70,162,.35), 0 2px 8px rgba(0,0,0,.15)'
                              : `0 ${4 + (swipeProgress / 100) * 8}px ${12 + (swipeProgress / 100) * 16}px rgba(0,0,0,${0.15 + (swipeProgress / 100) * 0.1})`,
                          }}
                        >
                          {swipeProgress >= 80 ? '✓' : '→'}
                        </div>
                        <span className="swipe-label">
                          {orderSubmitting ? 'Placing…' : swipeProgress >= 80 ? 'Release to confirm' : 'Swipe right'}
                        </span>
                      </div>
                    </div>
                    <button type="button" className="btn bout bbl" style={{ marginTop: 16 }} onClick={() => setSd((s) => ({ ...s, step: 2 }))}>
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
                        <button type="button" className="btn bout bbl" onClick={() => setViewingBill(b)}>
                          View bill
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {screen === 'profile' && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div className="pa">{(user.fn || 'U').charAt(0).toUpperCase()}</div>
                  <p className="st" style={{ marginTop: 8 }}>{user.fn || 'User'}</p>
                  <p className="vd">{user.em || ''}</p>
                  {user.ph && <p className="vd">{user.ph}</p>}
                </div>
                {LSApi.hasSupabase && (
                  <div className="oc" style={{ marginBottom: 16 }}>
                    <p className="st" style={{ marginBottom: 8 }}>Sign in with email</p>
                    <p className="vd" style={{ fontSize: 13, marginBottom: 12 }}>Set a password so you can also sign in with {user.em || 'your email'} and password (same account).</p>
                    <form onSubmit={handleSetPasswordForEmail}>
                      <div className="fg">
                        <label className="fl">Password</label>
                        <input type="password" className="fi" placeholder="Min 6 characters" value={profilePw} onChange={(e) => setProfilePw(e.target.value)} minLength={6} autoComplete="new-password" />
                      </div>
                      <div className="fg">
                        <label className="fl">Confirm password</label>
                        <input type="password" className="fi" placeholder="Same as above" value={profilePwConfirm} onChange={(e) => setProfilePwConfirm(e.target.value)} minLength={6} autoComplete="new-password" />
                      </div>
                      <button type="submit" className="btn bout bbl" disabled={profilePwSaving || !profilePw || !profilePwConfirm}>
                        {profilePwSaving ? 'Setting…' : 'Set password for email sign-in'}
                      </button>
                    </form>
                  </div>
                )}
                <div className="oc" style={{ marginBottom: 16 }}>
                    <p className="st" style={{ marginBottom: 8 }}>Push notifications</p>
                    <p className="vd" style={{ fontSize: 13 }}>Pickup reminders and updates are sent to the LaundroSwipe mobile app (Expo). Enable notifications in the app to receive them.</p>
                  </div>
                <div className="pmi" onClick={() => go('my-bills')}>
                  <div className="pmic bl2">🧾</div>
                  <span>My bills</span>
                </div>
                <div className="pmi" onClick={() => go('edit-profile')}>
                  <div className="pmic bl2">📋</div>
                  <span>Edit profile</span>
                </div>
                <div className="pmi" onClick={() => go('notifications')}>
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
          <button type="button" className={`ni ${tab === 'schedule' ? 'ct a' : ''}`} onClick={() => { setSd({ step: 0 }); go('schedule'); }}>
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
        {viewingBill && (
          <div className="bill-popup-overlay" onClick={() => setViewingBill(null)} role="dialog" aria-modal="true" aria-label="View bill">
            <div className="bill-popup-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontFamily: 'var(--fd)', fontSize: 18, margin: 0, color: 'var(--b)' }}>Bill #{viewingBill.order_token}</h3>
                <button type="button" className="btn bout bsm" onClick={() => setViewingBill(null)} aria-label="Close">Close</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 4 }}><strong>Order:</strong> {viewingBill.order_number ?? '—'}</p>
              <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 4 }}><strong>Date:</strong> {viewingBill.created_at ? new Date(viewingBill.created_at).toLocaleString() : '—'}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12, marginBottom: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0' }}>Item</th>
                    <th style={{ textAlign: 'right', padding: '8px 0' }}>₹</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(viewingBill.line_items) ? viewingBill.line_items : []).map((l: { label: string; qty: number; price: number }, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--bd)' }}>
                      <td style={{ padding: '6px 0' }}>{l.label} ×{l.qty}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>₹{l.price * l.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ textAlign: 'right', fontSize: 13, marginBottom: 2 }}>Subtotal: ₹{viewingBill.subtotal}</p>
              <p style={{ textAlign: 'right', fontSize: 13, marginBottom: 2 }}>Convenience fee: ₹{viewingBill.convenience_fee}</p>
              <p style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, marginTop: 8, paddingTop: 8, borderTop: '2px solid var(--b)' }}>Total: ₹{viewingBill.total}</p>
            </div>
          </div>
        )}
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
