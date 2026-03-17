'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type LocationStatus = 'idle' | 'checking' | 'serviceable' | 'unserviceable' | 'error' | 'denied';

type DemandRequestState = 'idle' | 'submitting' | 'success' | 'error';

const VIT_CHENNAI_COORDS = {
  lat: 12.8406,
  lng: 80.1531,
};

const SERVICE_RADIUS_KM = 10;

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function distanceInKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export default function HomePage() {
  const router = useRouter();
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [demandState, setDemandState] = useState<DemandRequestState>('idle');
  const [demandError, setDemandError] = useState<string | null>(null);
  const [locationText, setLocationText] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const isServiceable = locationStatus === 'serviceable';

  const distanceFromVit = useMemo(() => {
    if (!coords) return null;
    return distanceInKm(coords, VIT_CHENNAI_COORDS);
  }, [coords]);

  const handleGoToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const handleManualVitSelect = useCallback(() => {
    setLocationStatus('serviceable');
  }, []);

  const handleCheckAvailability = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    setLocationStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const current = { lat: latitude, lng: longitude };
        setCoords(current);
        const d = distanceInKm(current, VIT_CHENNAI_COORDS);
        if (Number.isFinite(d) && d <= SERVICE_RADIUS_KM) {
          setLocationStatus('serviceable');
        } else {
          setLocationStatus('unserviceable');
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
        } else {
          setLocationStatus('error');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60_000,
      },
    );
  }, []);

  const handleSubmitDemand = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!locationText.trim()) {
        setDemandError('Please tell us your college, area, or city.');
        return;
      }
      setDemandError(null);
      setDemandState('submitting');
      try {
        const res = await fetch('/api/location-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationText: locationText.trim(),
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            contactEmail: contactEmail.trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          setDemandState('error');
          setDemandError(data?.error || 'Something went wrong. Please try again.');
          return;
        }
        setDemandState('success');
        setLocationText('');
        setContactEmail('');
      } catch {
        setDemandState('error');
        setDemandError('Could not submit your request. Please try again.');
      }
    },
    [coords?.lat, coords?.lng, locationText, contactEmail],
  );

  useEffect(() => {
    setDemandError(null);
  }, [locationText, contactEmail]);

  return (
    <main className="ls-home">
      <div className="relative mx-auto max-w-6xl px-4 pt-4 pb-10 md:px-6 lg:px-8">
        <header className="ls-home-header mb-4 rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-2xl bg-slate-900/80 ring-1 ring-slate-700/70">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(96,165,250,0.5),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(56,189,248,0.55),transparent_55%)]" />
                <img
                  src="/icon-192.png"
                  alt="LaundroSwipe logo"
                  className="relative z-10 h-full w-full object-contain p-1.5"
                />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Kerala-based startup
                </p>
                <p className="text-sm font-semibold text-slate-100">
                  LaundroSwipe · Laundry in one swipe
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="ghost"
                size="pill"
                onClick={handleCheckAvailability}
                disabled={locationStatus === 'checking'}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                {locationStatus === 'checking'
                  ? 'Checking availability…'
                  : 'Check availability'}
              </Button>
              <Button
                size="pill"
                variant="subtle"
                onClick={handleGoToDashboard}
              >
                Login / Dashboard
              </Button>
            </div>
          </div>
        </header>

        <section className="ls-home-hero">
          <div className="space-y-6 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 shadow-[0_18px_45px_rgba(16,185,129,0.4)]">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              <span>Live for VIT Chennai · Expanding to more campuses</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-balance font-display text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl md:text-5xl">
                Campus-ready laundry pickup &amp; delivery, done in one swipe.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
                LaundroSwipe connects students and busy professionals to trusted laundry
                partners. Schedule pickups, track your clothes, and get fresh laundry back
                without ever leaving your room.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={handleCheckAvailability}
                disabled={locationStatus === 'checking'}
                className="shadow-soft-xl animate-pulse-soft"
              >
                {locationStatus === 'checking'
                  ? 'Checking your location…'
                  : 'Check availability near me'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleGoToDashboard}
                className="border-slate-600/70 bg-slate-900/60 text-slate-100 hover:bg-slate-900 hover:border-slate-400"
              >
                Login / Go to dashboard
              </Button>
            </div>

            <p className="text-xs text-slate-400">
              Kerala-based, operating for 2+ years across residential communities, corporate
              offices, and educational campuses.
            </p>
          </div>

          <div className="ls-home-hero-card animate-float-slow">
            <div className="ls-home-hero-card-inner">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2>How LaundroSwipe works</h2>
                <span className="rounded-full bg-slate-900/70 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Partner-powered platform
                </span>
              </div>
              <ol>
                <li>
                  <strong>We partner with verified laundries.</strong> In each city we work
                  with reliable dry cleaners and laundry providers so you don&apos;t have to
                  keep searching or negotiating with new shops.
                </li>
                <li>
                  <strong>You book in a few taps.</strong> Pick your service, choose a pickup
                  slot, and share simple instructions from your phone or laptop.
                </li>
                <li>
                  <strong>Pickup, processing, and delivery.</strong> Our partners collect,
                  wash, iron, and deliver your clothes back to you, while you track everything
                  through your dashboard.
                </li>
                <li>
                  <strong>Transparent status.</strong> Tokens, statuses, and bills stay in one
                  place, so you always know what&apos;s happening with your laundry.
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="ls-home-about" aria-labelledby="about-heading">
          <div className="ls-home-section-inner grid gap-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)]">
            <div className="ls-home-about-text space-y-4 animate-fade-up">
              <h2
                id="about-heading"
                className="font-display text-xl font-semibold text-slate-50 md:text-2xl"
              >
                Built in Kerala, serving modern India&apos;s laundry needs
              </h2>
              <p className="text-sm leading-relaxed text-slate-300 md:text-[0.95rem]">
                LaundroSwipe is a Kerala-based startup with offices in Kochi and Bangalore.
                For over two years, we&apos;ve been helping customers across residential
                areas, corporate offices, and educational institutions get their laundry done
                without friction.
              </p>
              <p className="text-sm leading-relaxed text-slate-300 md:text-[0.95rem]">
                Our platform brings together carefully vetted dry cleaners and laundry service
                providers, so you don&apos;t have to worry about quality or reliability. We
                handle discovery, scheduling, coordination, and communication — you just choose
                a service and a time that works for you.
              </p>
            </div>

            <div className="ls-home-stats">
              <div className="ls-home-stat-card animate-fade-up">
                <span className="ls-home-stat-label">Operational</span>
                <span className="ls-home-stat-value">2+ years</span>
              </div>
              <div className="ls-home-stat-card animate-fade-up">
                <span className="ls-home-stat-label">Offices</span>
                <span className="ls-home-stat-value">Kochi &amp; Bangalore</span>
              </div>
              <div className="ls-home-stat-card animate-fade-up">
                <span className="ls-home-stat-label">Use cases</span>
                <span className="ls-home-stat-value">Homes • Corporates • Campuses</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ls-home-vit" aria-labelledby="vit-heading">
          <div className="ls-home-section-inner grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)]">
            <div className="space-y-4 animate-fade-up">
              <h2
                id="vit-heading"
                className="font-display text-xl font-semibold text-slate-50 md:text-2xl"
              >
                Focused experience for VIT Chennai students
              </h2>
              <p className="text-sm leading-relaxed text-slate-300 md:text-[0.95rem]">
                The current web app is optimized for VIT Chennai. Students can book campus
                pickups on specific days, get a digital token, and track their orders from
                pickup to delivery — all in one place.
              </p>
              <p className="text-sm leading-relaxed text-slate-300 md:text-[0.95rem]">
                Once you&apos;re within the VIT Chennai service radius, you&apos;ll see a
                dedicated dashboard with campus-aware slots, vendor details, and transparent
                pricing powered by our local partner.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  size="lg"
                  variant="default"
                  onClick={handleCheckAvailability}
                  disabled={locationStatus === 'checking'}
                  className="shadow-soft-xl"
                >
                  {locationStatus === 'checking'
                    ? 'Checking your location…'
                    : "Check if I'm in VIT Chennai"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleManualVitSelect}
                  className="border-slate-600/70 bg-slate-900/60 text-slate-100 hover:bg-slate-900 hover:border-slate-400"
                >
                  I&apos;m a VIT Chennai student
                </Button>
              </div>

              <p className="text-xs text-slate-400">
                Already use LaundroSwipe?{' '}
                <button
                  type="button"
                  className="ls-home-link-button"
                  onClick={handleGoToDashboard}
                >
                  Go to dashboard
                </button>
              </p>
            </div>

            <div className="space-y-4 animate-fade-up">
              <div className="ls-home-availability space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Availability near you
                </h3>
                {locationStatus === 'idle' && (
                  <p className="text-xs text-slate-400">
                    Tap &quot;Check availability&quot; to see if we&apos;re live in your area.
                  </p>
                )}
                {locationStatus === 'checking' && (
                  <p className="text-xs text-slate-300">
                    Checking if you&apos;re near VIT Chennai…
                  </p>
                )}
                {isServiceable && (
                  <div className="ls-home-availability-card ls-home-availability-ok space-y-3">
                    <h4 className="text-sm font-semibold text-emerald-200">
                      Good news — we&apos;re serving your area
                    </h4>
                    <p className="text-xs text-emerald-100/90">
                      You&apos;re within our VIT Chennai service radius. Continue to the
                      dashboard to log in, schedule pickups, and manage your orders.
                    </p>
                    <Button
                      size="lg"
                      variant="default"
                      onClick={handleGoToDashboard}
                      className="bg-emerald-500 hover:bg-emerald-600 shadow-soft-xl"
                    >
                      Continue to VIT Chennai dashboard
                    </Button>
                    {distanceFromVit != null && (
                      <p className="ls-home-distance">
                        Approximate distance from VIT Chennai: {distanceFromVit.toFixed(1)} km
                      </p>
                    )}
                  </div>
                )}
                {(locationStatus === 'unserviceable' ||
                  locationStatus === 'error' ||
                  locationStatus === 'denied') && (
                  <div className="ls-home-availability-card ls-home-availability-soon space-y-3">
                    <h4 className="text-sm font-semibold text-amber-200">
                      We&apos;re not in your area yet
                    </h4>
                    <p className="text-xs text-slate-300">
                      LaundroSwipe is expanding to more campuses and neighbourhoods. Tell us
                      where you&apos;d like to see us next and we&apos;ll use that to plan new
                      launches.
                    </p>
                    {locationStatus === 'denied' && (
                      <p className="ls-home-availability-hint text-xs text-amber-200/90">
                        Location permission was blocked. You can still let us know your college
                        or area below.
                      </p>
                    )}
                    {locationStatus === 'error' && (
                      <p className="ls-home-availability-hint text-xs text-amber-200/90">
                        We couldn&apos;t detect your location automatically. You can share your
                        college or area below.
                      </p>
                    )}
                    {distanceFromVit != null && (
                      <p className="ls-home-distance">
                        Approximate distance from VIT Chennai: {distanceFromVit.toFixed(1)} km
                      </p>
                    )}
                    <form
                      className="ls-home-demand-form space-y-3"
                      onSubmit={handleSubmitDemand}
                    >
                      <label className="ls-home-field flex flex-col gap-1 text-xs text-slate-300">
                        <span>Your college / area / city</span>
                        <input
                          type="text"
                          value={locationText}
                          onChange={(e) => setLocationText(e.target.value)}
                          placeholder="e.g. College name, locality, city"
                          required
                          className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none ring-0 transition focus:border-brand focus:ring-1 focus:ring-brand/70"
                        />
                      </label>
                      <label className="ls-home-field flex flex-col gap-1 text-xs text-slate-300">
                        <span>Email (optional, for follow-up)</span>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none ring-0 transition focus:border-brand focus:ring-1 focus:ring-brand/70"
                        />
                      </label>
                      {demandError && <p className="ls-home-error">{demandError}</p>}
                      <Button
                        type="submit"
                        variant="outline"
                        size="lg"
                        disabled={demandState === 'submitting'}
                        className="w-full border-slate-600/80 bg-slate-900/70 text-slate-100 hover:bg-slate-900 hover:border-slate-400"
                      >
                        {demandState === 'submitting'
                          ? 'Sending your request…'
                          : 'Request LaundroSwipe in my area'}
                      </Button>
                      {demandState === 'success' && (
                        <p className="ls-home-success">
                          Thanks for your interest! We&apos;ve recorded your request.
                        </p>
                      )}
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="ls-home-how" aria-labelledby="how-heading">
          <div className="ls-home-section-inner space-y-4">
            <h2
              id="how-heading"
              className="font-display text-xl font-semibold text-slate-50 md:text-2xl"
            >
              Why customers choose LaundroSwipe
            </h2>
            <div className="ls-home-how-grid">
              <article className="ls-home-how-card animate-fade-up">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">
                  Reliable partners
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  We onboard only verified dry cleaners and laundry providers. That means
                  predictable quality, clear pricing, and better consistency than negotiating
                  with new shops every time.
                </p>
              </article>
              <article className="ls-home-how-card animate-fade-up">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">
                  One place for everything
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  Discovery, pickup slots, order tracking, tokens, and bills — everything lives
                  in one dashboard instead of scattered across calls and messages.
                </p>
              </article>
              <article className="ls-home-how-card animate-fade-up">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">
                  Designed for campuses
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  For institutions like VIT Chennai, we optimize for real-life student
                  schedules, pickup windows, and hostel logistics so that laundry fits around
                  classes, not the other way around.
                </p>
              </article>
            </div>
          </div>
        </section>

        <footer className="ls-home-footer">
          <div className="ls-home-section-inner ls-home-footer-inner">
            <div className="space-y-2">
              <span className="ls-home-brand text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                LaundroSwipe
              </span>
              <p className="max-w-md text-xs leading-relaxed text-slate-300">
                Kerala-based laundry technology company connecting trusted service partners to
                customers across homes, offices, and campuses.
              </p>
            </div>
            <div className="ls-home-footer-columns">
              <div className="ls-home-footer-col space-y-2 text-xs text-slate-300">
                <h3 className="text-sm font-semibold text-slate-100">Contact</h3>
                <p>
                  Email:{' '}
                  <a
                    href="mailto:support@laundroswipe.com"
                    className="font-semibold text-sky-200 hover:text-sky-100"
                  >
                    support@laundroswipe.com
                  </a>
                  <br />
                  Phone:{' '}
                  <a
                    href="tel:+919074417293"
                    className="font-semibold text-sky-200 hover:text-sky-100"
                  >
                    +91 90744 17293
                  </a>
                </p>
              </div>
              <div className="ls-home-footer-col text-xs text-slate-300">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">Links</h3>
                <ul className="space-y-1.5">
                  <li>
                    <Link
                      href="/privacy"
                      className="text-sky-200 hover:text-sky-100 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms"
                      className="text-sky-200 hover:text-sky-100 hover:underline"
                    >
                      Terms &amp; Conditions
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin"
                      className="text-sky-200 hover:text-sky-100 hover:underline"
                    >
                      Admin
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="ls-home-link-button"
                      onClick={handleGoToDashboard}
                    >
                      Go to dashboard
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            <p className="ls-home-footer-copy text-[0.7rem] text-slate-500">
              © {new Date().getFullYear()} LaundroSwipe. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

