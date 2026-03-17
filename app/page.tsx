'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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
      <header className="ls-home-header">
        <div className="ls-home-logo">
          <img src="/icon-192.png" alt="LaundroSwipe logo" className="ls-home-logo-img" />
          <div className="ls-home-logo-text">
            <span className="ls-home-brand">LaundroSwipe</span>
            <span className="ls-home-tagline">Your laundry sorted in one swipe</span>
          </div>
        </div>
        <nav className="ls-home-nav">
          <button type="button" className="ls-home-nav-link" onClick={handleCheckAvailability}>
            Check availability
          </button>
          <button
            type="button"
            className="ls-home-nav-cta"
            onClick={handleGoToDashboard}
          >
            Login / Dashboard
          </button>
        </nav>
      </header>

      <section className="ls-home-hero">
        <div className="ls-home-hero-copy">
          <h1>Campus-ready laundry pickup &amp; delivery, done in one swipe.</h1>
          <p>
            LaundroSwipe connects students and busy professionals to trusted laundry partners.
            Schedule pickups, track your clothes, and get fresh laundry back without ever
            leaving your room.
          </p>
          <div className="ls-home-hero-actions">
            <button
              type="button"
              className="ls-home-primary"
              onClick={handleCheckAvailability}
              disabled={locationStatus === 'checking'}
            >
              {locationStatus === 'checking' ? 'Checking your location…' : 'Check availability near me'}
            </button>
            <button
              type="button"
              className="ls-home-secondary"
              onClick={handleGoToDashboard}
            >
              Login / Go to dashboard
            </button>
          </div>
          <p className="ls-home-hero-meta">
            Kerala-based, operating for 2+ years across residential communities, corporate offices,
            and educational campuses.
          </p>
        </div>
        <div className="ls-home-hero-card">
          <div className="ls-home-hero-card-inner">
            <h2>How LaundroSwipe works</h2>
            <ol>
              <li>
                <strong>We partner with verified laundries.</strong> Just like food delivery apps
                connect local kitchens to hungry customers, we connect reliable laundry services
                to people who want hassle-free cleaning.
              </li>
              <li>
                <strong>You book in a few taps.</strong> Pick your service, choose a pickup slot,
                and share simple instructions.
              </li>
              <li>
                <strong>Pickup, processing, and delivery.</strong> Our partners collect, wash,
                iron, and deliver your clothes back to you.
              </li>
              <li>
                <strong>Transparent status.</strong> See tokens, statuses, and bills directly in
                the app.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="ls-home-about" aria-labelledby="about-heading">
        <div className="ls-home-section-inner">
          <div className="ls-home-about-text">
            <h2 id="about-heading">Built in Kerala, serving modern India’s laundry needs</h2>
            <p>
              LaundroSwipe is a Kerala-based startup with offices in Kochi and Bangalore. For over
              two years, we&apos;ve been helping customers across residential areas, corporate
              offices, and educational institutions get their laundry done without friction.
            </p>
            <p>
              Our platform brings together carefully vetted dry cleaners and laundry service
              providers, so you don&apos;t have to worry about quality or reliability. We handle
              discovery, scheduling, coordination, and communication — you just choose a service
              and a time that works for you.
            </p>
          </div>
          <div className="ls-home-stats">
            <div className="ls-home-stat-card">
              <span className="ls-home-stat-label">Operational</span>
              <span className="ls-home-stat-value">2+ years</span>
            </div>
            <div className="ls-home-stat-card">
              <span className="ls-home-stat-label">Offices</span>
              <span className="ls-home-stat-value">Kochi &amp; Bangalore</span>
            </div>
            <div className="ls-home-stat-card">
              <span className="ls-home-stat-label">Use cases</span>
              <span className="ls-home-stat-value">Homes • Corporates • Campuses</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ls-home-vit" aria-labelledby="vit-heading">
        <div className="ls-home-section-inner">
          <div className="ls-home-vit-text">
            <h2 id="vit-heading">Focused experience for VIT Chennai students</h2>
            <p>
              The current web app is optimized for VIT Chennai. Students can book campus pickups
              on specific days, get a digital token, and track their orders from pickup to
              delivery — all in one place.
            </p>
            <p>
              Once you&apos;re within the VIT Chennai service radius, you&apos;ll see a dedicated
              dashboard with campus-aware slots, vendor details, and transparent pricing powered
              by our local partner.
            </p>
            <div className="ls-home-vit-actions">
              <button
                type="button"
                className="ls-home-primary"
                onClick={handleCheckAvailability}
                disabled={locationStatus === 'checking'}
              >
                {locationStatus === 'checking' ? 'Checking your location…' : 'Check if I&apos;m in VIT Chennai'}
              </button>
              <button
                type="button"
                className="ls-home-secondary"
                onClick={handleManualVitSelect}
              >
                I&apos;m a VIT Chennai student
              </button>
            </div>
            <p className="ls-home-vit-note">
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
          <div className="ls-home-availability">
            <h3>Availability near you</h3>
            {locationStatus === 'idle' && (
              <p>Tap &quot;Check availability&quot; to see if we&apos;re live in your area.</p>
            )}
            {locationStatus === 'checking' && <p>Checking if you&apos;re near VIT Chennai…</p>}
            {isServiceable && (
              <div className="ls-home-availability-card ls-home-availability-ok">
                <h4>Good news — we&apos;re serving your area</h4>
                <p>
                  You&apos;re within our VIT Chennai service radius. Continue to the dashboard to
                  log in, schedule pickups, and manage your orders.
                </p>
                <button
                  type="button"
                  className="ls-home-primary"
                  onClick={handleGoToDashboard}
                >
                  Continue to VIT Chennai dashboard
                </button>
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
              <div className="ls-home-availability-card ls-home-availability-soon">
                <h4>We&apos;re not in your area yet</h4>
                <p>
                  LaundroSwipe is expanding to more campuses and neighbourhoods. Tell us where
                  you&apos;d like to see us next and we&apos;ll use that to plan new launches.
                </p>
                {locationStatus === 'denied' && (
                  <p className="ls-home-availability-hint">
                    Location permission was blocked. You can still let us know your college or
                    area below.
                  </p>
                )}
                {locationStatus === 'error' && (
                  <p className="ls-home-availability-hint">
                    We couldn&apos;t detect your location automatically. You can share your
                    college or area below.
                  </p>
                )}
                {distanceFromVit != null && (
                  <p className="ls-home-distance">
                    Approximate distance from VIT Chennai: {distanceFromVit.toFixed(1)} km
                  </p>
                )}
                <form className="ls-home-demand-form" onSubmit={handleSubmitDemand}>
                  <label className="ls-home-field">
                    <span>Your college / area / city</span>
                    <input
                      type="text"
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      placeholder="e.g. College name, locality, city"
                      required
                    />
                  </label>
                  <label className="ls-home-field">
                    <span>Email (optional, for follow-up)</span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  {demandError && <p className="ls-home-error">{demandError}</p>}
                  <button
                    type="submit"
                    className="ls-home-secondary"
                    disabled={demandState === 'submitting'}
                  >
                    {demandState === 'submitting'
                      ? 'Sending your request…'
                      : 'Request LaundroSwipe in my area'}
                  </button>
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
      </section>

      <section className="ls-home-how" aria-labelledby="how-heading">
        <div className="ls-home-section-inner">
          <h2 id="how-heading">Why customers choose LaundroSwipe</h2>
          <div className="ls-home-how-grid">
            <article className="ls-home-how-card">
              <h3>Reliable partners</h3>
              <p>
                We onboard only verified dry cleaners and laundry providers. That means
                predictable quality, clear pricing, and better consistency than negotiating with
                new shops every time.
              </p>
            </article>
            <article className="ls-home-how-card">
              <h3>One place for everything</h3>
              <p>
                Discovery, pickup slots, order tracking, tokens, and bills — everything lives in
                one dashboard instead of scattered across calls and messages.
              </p>
            </article>
            <article className="ls-home-how-card">
              <h3>Designed for campuses</h3>
              <p>
                For institutions like VIT Chennai, we optimize for real-life student schedules,
                pickup windows, and hostel logistics so that laundry fits around classes, not the
                other way around.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="ls-home-footer">
        <div className="ls-home-section-inner ls-home-footer-inner">
          <div className="ls-home-footer-brand">
            <span className="ls-home-brand">LaundroSwipe</span>
            <p>
              Kerala-based laundry technology company connecting trusted service partners to
              customers across homes, offices, and campuses.
            </p>
          </div>
          <div className="ls-home-footer-columns">
            <div className="ls-home-footer-col">
              <h3>Contact</h3>
              <p>
                Email:{' '}
                <a href="mailto:support@laundroswipe.com">
                  support@laundroswipe.com
                </a>
                <br />
                Phone: <a href="tel:+919074417293">+91 90744 17293</a>
              </p>
            </div>
            <div className="ls-home-footer-col">
              <h3>Links</h3>
              <ul>
                <li>
                  <Link href="/privacy">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/terms">Terms &amp; Conditions</Link>
                </li>
                <li>
                  <Link href="/admin">Admin</Link>
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
          <p className="ls-home-footer-copy">
            © {new Date().getFullYear()} LaundroSwipe. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

