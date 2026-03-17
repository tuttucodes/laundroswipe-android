/**
 * Premium LaundroSwipe homepage (marketing only).
 * Dashboard and auth flows (LaundroApp, /dashboard, admin) remain untouched.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Package, CheckCircle2, Instagram, Twitter, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stats = [
  { label: 'Orders Delivered', value: 10000, suffix: '+' },
  { label: 'Verified Partners', value: 500, suffix: '+' },
  { label: 'Cities Live', value: 3, suffix: '' },
  { label: 'Avg. Rating', value: 4.7, suffix: '/5' },
];

const howSteps = [
  {
    icon: MapPin,
    title: '📍 Enter Your Location',
    description: "Tell us where you are. We'll find the best laundry partners near you.",
  },
  {
    icon: Package,
    title: '👕 Schedule a Pickup',
    description: 'Choose your items, pick a time slot, and we handle the rest.',
  },
  {
    icon: CheckCircle2,
    title: '✅ Fresh Clothes, Delivered',
    description: 'Your clothes come back cleaned, ironed, and delivered to your door.',
  },
];

const features = [
  {
    title: 'Verified Partners Only',
    description: 'Every vendor is background-checked and quality-rated.',
  },
  {
    title: 'Real-Time Tracking',
    description: 'Know exactly where your clothes are.',
  },
  {
    title: 'Transparent Pricing',
    description: 'No hidden fees, ever.',
  },
  {
    title: 'Multi-Location Support',
    description: 'Homes, offices, hostels, PGs — we serve everywhere.',
  },
  {
    title: 'Eco-Friendly Options',
    description: 'Choose green-certified cleaners.',
  },
  {
    title: '24/7 Support',
    description: "We're always a message away.",
  },
];

const testimonials = [
  {
    quote:
      'LaundroSwipe saved me so much time. I just schedule and forget!',
    name: 'Anjali R.',
    role: 'Kochi',
  },
  {
    quote: 'Finally a laundry service that actually delivers on time.',
    name: 'Rahul M.',
    role: 'Bangalore',
  },
  {
    quote:
      'The quality is consistent and prices are transparent. Love it.',
    name: 'Priya S.',
    role: 'Ernakulam',
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const staggerChildren = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const isDecimal = !Number.isInteger(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = value * progress;
      setDisplay(isDecimal ? parseFloat(next.toFixed(1)) : Math.round(next));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function GlassCard(props: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className={`rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200 shadow-[0_22px_90px_rgba(15,23,42,0.95)] backdrop-blur-2xl ${props.className ?? ''}`}
    >
      {props.children}
    </motion.div>
  );
}

function WashingMachine() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6 }}
      className="relative h-full min-h-[260px] rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_28px_90px_rgba(15,23,42,1)]"
    >
      <div className="absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(circle_at_0_0,rgba(96,165,250,0.5),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.5),transparent_55%)] opacity-70 blur-xl" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
            LaundroSwipe App
          </div>
          <div className="text-sm font-semibold text-white">
            Schedule pickup in one swipe
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Live
        </span>
      </div>
      <div className="relative grid grid-cols-1 gap-3 rounded-2xl bg-slate-900/80 p-4 text-xs text-slate-200">
        <div className="flex items-center justify-between">
          <span>Pickup slot</span>
          <span className="text-[0.7rem] text-emerald-300">Today · 4–6 PM</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Service</span>
          <span className="text-[0.7rem] text-sky-300">Wash &amp; Fold</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Status</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.7rem] text-emerald-300">
            Rider on the way
          </span>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-500/20 to-cyan-500/10 px-4 py-3 text-xs text-slate-100">
        <div className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-300">
          Why customers love us
        </div>
        <p className="mt-1 text-[0.8rem] text-slate-100">
          Single dashboard for pickups, tokens, and bills. No more chasing laundry slips.
        </p>
      </div>
      <motion.div
        className="absolute -right-4 bottom-6 h-20 w-20 rounded-full border border-sky-400/40 bg-sky-500/10 text-3xl shadow-[0_0_30px_rgba(56,189,248,0.6)]"
        animate={{ rotate: [0, 12, -8, 4, 0] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: 'mirror' }}
      >
        <div className="flex h-full w-full items-center justify-center">🧺</div>
      </motion.div>
    </motion.div>
  );
}

function TestimonialCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % testimonials.length),
      6000,
    );
    return () => clearInterval(id);
  }, []);

  const current = testimonials[index];

  return (
    <GlassCard className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-cyan-900/60 p-6">
      <motion.div
        key={index}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-sm text-slate-100 md:text-base">&ldquo;{current.quote}&rdquo;</p>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
          <div>
            <div className="font-semibold text-white">{current.name}</div>
            <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
              {current.role}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex text-amber-400">
              {'★★★★★'}
            </div>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to testimonial ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-4 bg-sky-400' : 'w-2 bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </GlassCard>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [navScrolled, setNavScrolled] = useState(false);
  const [waitlistState, setWaitlistState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistForm, setWaitlistForm] = useState({ name: '', email: '', city: '' });

  useEffect(() => {
    const onScroll = () => {
      setNavScrolled(window.scrollY > 10);
    };
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistState('loading');
    setWaitlistError(null);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waitlistForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setWaitlistState('error');
        setWaitlistError(data?.error || 'Something went wrong. Please try again.');
        return;
      }
      setWaitlistState('success');
      setWaitlistForm({ name: '', email: '', city: '' });
    } catch {
      setWaitlistState('error');
      setWaitlistError('Network error. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">

      <motion.header
        initial={false}
        animate={{
          backdropFilter: navScrolled ? 'blur(22px)' : 'blur(16px)',
          backgroundColor: navScrolled ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.7)',
          borderBottomColor: navScrolled ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.7)',
        }}
        className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-slate-900/90 ring-1 ring-slate-700/80">
              <div className="absolute inset-0 bg-[conic-gradient(from_140deg_at_10%_0%,rgba(59,130,246,0.7),rgba(6,182,212,0.9),transparent_55%)] opacity-70" />
              <img
                src="/icon-192.png"
                alt="LaundroSwipe"
                className="relative z-10 h-6 w-6 object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                LaundroSwipe
              </p>
              <p className="text-xs text-slate-300">Laundry, simplified.</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-medium text-slate-300 md:flex">
            <a href="#hero" className="hover:text-white">
              Home
            </a>
            <a href="#how" className="hover:text-white">
              How It Works
            </a>
            <a href="#locations" className="hover:text-white">
              Locations
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden border border-white/10 bg-transparent text-xs text-slate-200 hover:bg-white/5 md:inline-flex"
              onClick={() => router.push('/dashboard')}
            >
              Login
            </Button>
            <Button
              size="sm"
              className="relative overflow-hidden bg-primary px-4 text-xs shadow-[0_0_20px_rgba(59,130,246,0.8)]"
              onClick={() => router.push('/dashboard')}
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(59,130,246,0.8),transparent_55%),radial-gradient(circle_at_100%_0,rgba(6,182,212,0.7),transparent_55%)] opacity-70" />
              <span className="relative z-10">Start Washing</span>
            </Button>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-14 md:px-10">
        <motion.section
          id="hero"
          className="grid items-center gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
        >
          <motion.div variants={fadeInUp} className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[0.7rem] font-medium text-sky-200 shadow-[0_18px_45px_rgba(56,189,248,0.4)]">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              <span>Live in Kochi · Bangalore · Chennai pilots</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-5xl">
                Laundry from your doorstep to done — in one swipe.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
                Enter your location to see trusted laundries near you. We handle pickup,
                tracking, and on‑time delivery — you just swipe and relax.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-[0_22px_70px_rgba(15,23,42,0.9)] sm:flex-row sm:items-center sm:p-4">
                <div className="flex flex-1 items-center gap-3 rounded-xl bg-slate-950/90 px-3 py-2.5 ring-1 ring-slate-700/70">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
                    <MapPin size={16} />
                  </span>
                  <input
                    placeholder="Enter delivery location (e.g. Kakkanad, HSR Layout)"
                    className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        router.push('/dashboard');
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full shadow-[0_0_28px_rgba(59,130,246,0.9)] sm:min-w-[170px]"
                    onClick={() => router.push('/dashboard')}
                  >
                    Find laundries near me
                  </Button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1 text-[0.75rem] font-medium text-slate-300 hover:text-white"
                    onClick={() => {
                      const el = document.getElementById('how');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                    30–45 min average pickup time
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs md:grid-cols-4">
                {stats.map((s) => (
                  <GlassCard
                    key={s.label}
                    className="py-3 text-center transition hover:-translate-y-1 hover:border-sky-400/60 hover:bg-sky-500/10"
                  >
                    <div className="text-lg font-semibold text-white md:text-xl">
                      <Counter value={s.value} suffix={s.suffix} />
                    </div>
                    <div className="mt-1 text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">
                      {s.label}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="relative"
            whileHover={{ y: -4, rotate: -0.6, transition: { duration: 0.4 } }}
          >
            <WashingMachine />
          </motion.div>
        </motion.section>

        <motion.section
          id="how"
          className="mt-20 space-y-6"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
        >
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-semibold text-white md:text-3xl">How It Works</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              From tap to doorstep, LaundroSwipe streamlines everything between you and your
              favorite laundry partners.
            </p>
          </motion.div>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {howSteps.map((step, idx) => (
              <GlassCard
                key={step.title}
                className="h-full transition hover:-translate-y-1.5 hover:border-sky-400/60 hover:bg-slate-900/70"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/60 to-cyan-400/60 text-slate-900 shadow-lg shadow-sky-500/40">
                  <step.icon size={18} />
                </div>
                <div className="mb-1 text-sm font-semibold text-white">{step.title}</div>
                <p className="text-xs text-slate-300">{step.description}</p>
              </GlassCard>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mt-20 space-y-6"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
        >
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-semibold text-white md:text-3xl">Why LaundroSwipe</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              A partner-first, customer-obsessed platform built in Kerala for the way modern
              India does laundry.
            </p>
          </motion.div>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <motion.div
                key={f.title}
                whileHover={{ y: -4, boxShadow: '0 0 40px rgba(59,130,246,0.6)' }}
                variants={fadeInUp}
                transition={{ duration: 0.35 }}
                className="group rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/80 p-4 text-xs text-slate-300"
              >
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/60 to-cyan-400/60 text-[0.8rem] text-slate-900 shadow-lg shadow-sky-500/40">
                  ✦
                </div>
                <div className="mb-1 text-sm font-semibold text-white">{f.title}</div>
                <p>{f.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          id="locations"
          className="mt-20 space-y-6"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
        >
          <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl font-semibold text-white md:text-3xl">Where We Operate</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Currently serving customers across Kerala, Kochi, and Bangalore. More cities
              coming soon.
            </p>
          </motion.div>
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <GlassCard className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0,rgba(59,130,246,0.4),transparent_55%),radial-gradient(circle_at_80%_100%,rgba(6,182,212,0.4),transparent_55%)] opacity-80" />
              <div className="relative z-10 space-y-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  India Coverage (Stylized)
                </p>
                <div className="relative mt-2 h-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
                  <div className="absolute left-1/3 top-6 h-40 w-40 rounded-full border border-sky-500/30 bg-sky-500/5 blur-3xl" />
                  <div className="absolute left-2/3 top-10 h-32 w-32 rounded-full border border-cyan-500/30 bg-cyan-500/5 blur-2xl" />
                  <div className="absolute inset-8 rounded-2xl border border-dashed border-slate-700/80" />
                  <div className="absolute left-[28%] top-[40%]">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
                    <div className="mt-1 text-[0.7rem] text-slate-200">Kochi</div>
                  </div>
                  <div className="absolute left-[48%] top-[55%]">
                    <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.9)]" />
                    <div className="mt-1 text-[0.7rem] text-slate-200">Bangalore</div>
                  </div>
                  <div className="absolute left-[52%] top-[35%]">
                    <div className="h-2 w-2 rounded-full bg-slate-200 shadow-[0_0_10px_rgba(148,163,184,0.8)]" />
                    <div className="mt-1 text-[0.7rem] text-slate-400">Chennai</div>
                  </div>
                  <div className="absolute left-[60%] top-[30%]">
                    <div className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                    </div>
                    <div className="mt-1 text-[0.7rem] text-amber-300">Hyderabad · Soon</div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="mx-auto w-full max-w-md space-y-3 text-xs md:mx-0">
              <GlassCard className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-white">Kochi</div>
                  <div className="text-[0.75rem] text-slate-300">Core operations · 50+ partners</div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Active
                </span>
              </GlassCard>
              <GlassCard className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-white">Bangalore</div>
                  <div className="text-[0.75rem] text-slate-300">
                    Enterprise &amp; residential clusters · 200+ partners
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Active
                </span>
              </GlassCard>
              <GlassCard className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-white">Chennai</div>
                  <div className="text-[0.75rem] text-slate-300">Campus-focused pilots in progress</div>
                </div>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber-300">
                  Limited
                </span>
              </GlassCard>
              <GlassCard className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-white">Hyderabad</div>
                  <div className="text-[0.75rem] text-slate-300">High-demand corridor · Launching soon</div>
                </div>
                <span className="rounded-full bg-slate-500/15 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  Coming Soon
                </span>
              </GlassCard>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="waitlist"
          className="mt-20 space-y-6"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
        >
          <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl font-semibold text-white md:text-3xl">
              We&apos;re Not In Your Area Yet?
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Don&apos;t worry — we&apos;re expanding fast. Drop your details and we&apos;ll
              notify you when we launch near you.
            </p>
          </motion.div>
          <GlassCard className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <form className="space-y-4" onSubmit={handleWaitlistSubmit}>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">Name</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                  value={waitlistForm.name}
                  onChange={(e) =>
                    setWaitlistForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                  value={waitlistForm.email}
                  onChange={(e) =>
                    setWaitlistForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">City</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                  value={waitlistForm.city}
                  onChange={(e) =>
                    setWaitlistForm((f) => ({ ...f, city: e.target.value }))
                  }
                  placeholder="Kochi, Bangalore, Hyderabad..."
                  required
                />
              </div>
              {waitlistState === 'error' && (
                <p className="text-xs text-red-400">{waitlistError}</p>
              )}
              {waitlistState === 'success' && (
                <p className="text-xs text-emerald-400">
                  You&apos;re on the list! 🎉 We&apos;ll email you when we launch near you.
                </p>
              )}
              <Button
                type="submit"
                disabled={waitlistState === 'loading'}
                className="mt-1 w-full rounded-full bg-primary shadow-[0_0_24px_rgba(59,130,246,0.9)]"
              >
                {waitlistState === 'loading' ? 'Submitting...' : 'Notify Me'}
              </Button>
            </form>
          </GlassCard>
        </motion.section>

        <motion.section
          id="testimonials"
          className="mt-20 space-y-6"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
        >
          <motion.div variants={fadeInUp} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl font-semibold text-white md:text-3xl">
              Loved by busy people
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              From students and young professionals to busy families, people rely on
              LaundroSwipe to take laundry off their mental load.
            </p>
          </motion.div>
          <TestimonialCarousel />
        </motion.section>

        <motion.section
          id="cta"
          className="mt-20 overflow-hidden rounded-3xl border border-sky-500/40 bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 p-[1px] shadow-[0_0_45px_rgba(59,130,246,0.9)]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
        >
          <motion.div
            variants={fadeInUp}
            className="flex flex-col items-start justify-between gap-4 rounded-[22px] bg-slate-950/90 px-6 py-6 text-left md:flex-row md:items-center md:px-8 md:py-7"
          >
            <div>
              <h2 className="text-xl font-semibold text-white md:text-2xl">
                Ready to Never Worry About Laundry Again?
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-200">
                Create your account in seconds and see how easy it is to schedule your next
                pickup.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-white px-5 text-sm font-semibold text-sky-700 hover:bg-slate-100"
                onClick={() => router.push('/dashboard')}
              >
                Get Started
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/40 bg-transparent text-sm text-white hover:bg-white/10"
                onClick={() => router.push('/contact')}
              >
                Contact Us
              </Button>
            </div>
          </motion.div>
        </motion.section>
      </main>

      <footer
        id="contact"
        className="border-t border-white/5 bg-slate-950/90 py-8 text-xs text-slate-400"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:flex-row md:justify-between md:px-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">LaundroSwipe</span>
              <span className="text-[0.7rem] text-slate-400">Laundry, simplified.</span>
            </div>
            <p className="max-w-xs text-[0.75rem] text-slate-400">
              Kerala-based laundry technology platform connecting trusted service partners to
              customers across homes, offices, and campuses.
            </p>
            <div className="flex gap-3 text-slate-400">
              <Link href="#" aria-label="Instagram" className="hover:text-white">
                <Instagram size={16} />
              </Link>
              <Link href="#" aria-label="Twitter" className="hover:text-white">
                <Twitter size={16} />
              </Link>
              <Link href="#" aria-label="LinkedIn" className="hover:text-white">
                <Linkedin size={16} />
              </Link>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Company
              </div>
              <ul className="space-y-1 text-[0.75rem]">
                <li>
                  <Link href="/privacy" className="hover:text-slate-200">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-slate-200">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Support
              </div>
              <ul className="space-y-1 text-[0.75rem]">
                <li>
                  <a href="mailto:support@laundroswipe.com" className="hover:text-slate-200">
                    support@laundroswipe.com
                  </a>
                </li>
                <li>
                  <a href="tel:+917736429562" className="hover:text-slate-200">
                    +91 7736429562
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Offices
              </div>
              <p className="text-[0.75rem] text-slate-400">
                Kochi · F223 DLF NTH SEAPORT AIRPORT ROAD KOCHI 682030
              </p>
              <p className="text-[0.75rem] text-slate-400">Offices in Kochi &amp; Bangalore</p>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-[0.7rem] text-slate-500">
          © {new Date().getFullYear()} LaundroSwipe. Made with ❤️ in Kerala.
        </div>
      </footer>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800/80 bg-slate-950/95 px-4 py-3 shadow-[0_-18px_60px_rgba(15,23,42,1)] md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="text-[0.7rem] leading-snug text-slate-300">
            <div className="font-semibold text-slate-100">Already using LaundroSwipe?</div>
            <div className="text-[0.7rem] text-slate-400">
              Open your dashboard to see pickups and tokens.
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-primary px-3 text-[0.7rem] shadow-[0_0_20px_rgba(59,130,246,0.9)]"
            onClick={() => router.push('/dashboard')}
          >
            Open dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}

