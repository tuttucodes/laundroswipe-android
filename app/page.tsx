import {
  ArrowRight,
  Building2,
  GraduationCap,
  Home,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import { supabase, hasSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { HomeContactForm } from '@/components/HomeContactForm';

type RawTestimonial = {
  id: number;
  quote: string | null;
  name: string | null;
  title: string | null;
  company: string | null;
  segment: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type Testimonial = {
  id: number;
  quote: string;
  name: string;
  title?: string;
  company?: string;
  segment?: string;
};

async function getTestimonials(): Promise<Testimonial[]> {
  const fallback: Testimonial[] = [
    {
      id: 1,
      quote:
        'LaundroSwipe has taken laundry completely off our plate. Our residents love the predictability and clean, neatly packed returns.',
      name: 'Operations Head',
      title: 'Student Housing',
      company: 'Kochi',
      segment: 'Residential Communities',
    },
    {
      id: 2,
      quote:
        'For our campus, the consistency of pickups and transparent tracking has been a game changer compared to managing vendors directly.',
      name: 'Admin Director',
      title: 'University Partner',
      company: 'Bangalore',
      segment: 'Education',
    },
    {
      id: 3,
      quote:
        'We onboarded LaundroSwipe across multiple offices and within weeks, internal teams stopped chasing laundry vendors.',
      name: 'Workplace Experience Lead',
      title: 'IT / Tech',
      company: 'Pan-India',
      segment: 'Corporate Offices',
    },
  ];

  if (!hasSupabase || !supabase) return fallback;

  try {
    const { data, error } = await supabase
      .from<RawTestimonial>('homepage_testimonials')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(6);

    if (error || !data || data.length === 0) {
      return fallback;
    }

    return data
      .map((row) => ({
        id: row.id,
        quote: row.quote ?? '',
        name: row.name ?? '',
        title: row.title ?? undefined,
        company: row.company ?? undefined,
        segment: row.segment ?? undefined,
      }))
      .filter((t) => t.quote && t.name);
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const testimonials = await getTestimonials();

  return (
    <main className="ls-home">
      {/* Top navigation / chrome */}
      <header className="ls-home-header">
        <div className="ls-home-section-inner flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-md">
              LS
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-slate-900">
                LaundroSwipe
              </span>
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                Kerala · Kochi · Bangalore
              </span>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-xs font-medium text-slate-600 md:flex">
            <a href="#services" className="hover:text-slate-900">
              Services
            </a>
            <a href="#ecosystem" className="hover:text-slate-900">
              Ecosystem
            </a>
            <a href="#testimonials" className="hover:text-slate-900">
              Testimonials
            </a>
            <a href="#contact" className="hover:text-slate-900">
              Contact
            </a>
          </nav>
          <Button
            asChild
            size="pill"
            className="hidden rounded-full bg-slate-900 px-6 text-xs font-semibold tracking-wide md:inline-flex"
          >
            <a href="#contact">
              Talk to our team
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="ls-home-hero">
        <div className="ls-home-section-inner flex flex-col items-center gap-10 pb-16 pt-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Kerala-based · Kochi SEZ &amp; Bangalore
            </p>
            <h1 className="text-center text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-slate-900 md:text-left md:text-[3.4rem]">
              FORGING A{' '}
              <span className="bg-gradient-to-r from-slate-900 via-slate-900 to-rose-600 bg-clip-text text-transparent">
                NETWORK
              </span>{' '}
              OF LAUNDRY EXPERIENCES
            </h1>
            <p className="max-w-xl text-center text-sm text-slate-600 md:text-left md:text-[0.95rem]">
              LaundroSwipe connects customers to verified dry cleaners and laundry partners – much
              like Swiggy or Zomato – with one modern interface that works across residential
              communities, corporate offices, and campuses.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <Button
                size="lg"
                className="rounded-full bg-slate-900 px-7 text-sm font-semibold tracking-wide"
              >
                <a href="/dashboard" className="flex items-center gap-2">
                  Open customer app
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="outline"
                size="pill"
                className="rounded-full border-slate-300 bg-white px-5 text-xs"
              >
                <a href="#contact" className="flex items-center gap-2">
                  Talk to team
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </a>
              </Button>
            </div>
            <p className="text-center text-xs text-slate-500 md:text-left">
              2+ years operational · Multi-location coverage · Built for Kerala first.
            </p>
          </div>

          <div className="w-full max-w-md rounded-3xl bg-slate-900 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-[0.75rem] uppercase tracking-[0.2em] text-slate-300">
              <span>The LaundroSwipe flow</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[0.65rem] text-slate-100">
                Kochi · Bangalore
              </span>
            </div>
            <ol className="space-y-4 px-6 py-5 text-sm text-slate-100/90">
              <li>
                <span className="font-semibold text-white">01 · Customer request</span>
                <p className="mt-1 text-xs text-slate-200/80">
                  Pickup scheduled in the LaundroSwipe app – slot, preferences, and special notes.
                </p>
              </li>
              <li>
                <span className="font-semibold text-white">02 · Intelligent routing</span>
                <p className="mt-1 text-xs text-slate-200/80">
                  We connect the order to the right partner based on pin-code, capacity, and SLAs.
                </p>
              </li>
              <li>
                <span className="font-semibold text-white">03 · Partner execution</span>
                <p className="mt-1 text-xs text-slate-200/80">
                  Pickup, processing, and delivery handled end-to-end with live status updates.
                </p>
              </li>
              <li>
                <span className="font-semibold text-white">04 · One relationship</span>
                <p className="mt-1 text-xs text-slate-200/80">
                  Properties and customers talk to one LaundroSwipe team, even when vendors change.
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Ecosystem strip */}
      <section id="ecosystem" className="ls-home-ecosystem">
        <div className="ls-home-section-inner">
          <div className="ls-home-ecosystem-bar">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
              THE LAUNDROSWIPE ECOSYSTEM
            </span>
            <div className="ls-home-ecosystem-tags">
              <span>Resident programs</span>
              <span>Campus laundry</span>
              <span>Corporate convenience</span>
              <span>Verified partner network</span>
              <span>Pickup &amp; delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* What we do / services */}
      <section id="services" className="ls-home-services">
        <div className="ls-home-section-inner space-y-8 py-14">
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-300">
              What we do
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-[2.1rem]">
              Engineering the everyday laundry experience.
            </h2>
            <p className="max-w-2xl text-sm text-slate-600 md:text-[0.95rem]">
              From individual users in apartment buildings to thousands of students on a campus, we
              design the pickup–to–delivery loop so that laundry feels like a background task, not a
              weekly project.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="ls-home-service-card">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1 text-[0.7rem] font-medium text-white">
                <Home className="h-3.5 w-3.5" />
                Residential communities
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Apartment complexes, gated societies &amp; hostels.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Centralised pickups, shared drop points, and configurable pricing per society. We
                remove the friction of residents chasing individual vendors.
              </p>
            </div>
            <div className="ls-home-service-card">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-1 text-[0.7rem] font-medium text-white">
                <Building2 className="h-3.5 w-3.5" />
                Corporate offices
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Workplace experience &amp; admin teams.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Convenience programs for employees, executive laundry, and recurring corporate
                requirements with a single LaundroSwipe account and consolidated reporting.
              </p>
            </div>
            <div className="ls-home-service-card">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1 text-[0.7rem] font-medium text-white">
                <GraduationCap className="h-3.5 w-3.5" />
                Colleges &amp; institutions
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Campus-wide laundry that actually scales.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Integrated pickups for hostels, student apartments, and staff quarters – with
                configured collection points and fixed turnaround times.
              </p>
            </div>
          </div>

          <div className="ls-home-stats">
            <div className="ls-home-stat-card">
              <p className="ls-home-stat-label">Years operational</p>
              <span className="ls-home-stat-value">2+ years</span>
              <p className="ls-home-stat-copy">
                LaundroSwipe has been live across multiple localities in Kerala and Bangalore.
              </p>
            </div>
            <div className="ls-home-stat-card">
              <p className="ls-home-stat-label">Service model</p>
              <span className="ls-home-stat-value">Platform-first</span>
              <p className="ls-home-stat-copy">
                A Swiggy / Zomato style layer between end-users and verified laundry partners.
              </p>
            </div>
            <div className="ls-home-stat-card">
              <p className="ls-home-stat-label">Partner promise</p>
              <span className="ls-home-stat-value">Verified &amp; supported</span>
              <p className="ls-home-stat-copy">
                Every partner is onboarded, trained, and supported by the LaundroSwipe operations
                team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials (Supabase-backed) */}
      <section id="testimonials" className="ls-home-testimonials">
        <div className="ls-home-section-inner space-y-8 py-16">
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-300">
              Why clients stay with us
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-[2.1rem]">
              What partners say about LaundroSwipe.
            </h2>
            <p className="max-w-xl text-xs text-slate-600 md:text-[0.85rem]">
              Testimonials are stored in Supabase so the stories you see here can be updated without
              touching the codebase.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-stretch">
            <div className="ls-home-testimonial-metrics">
              <div>
                <p className="ls-home-metric-label">Completed orders</p>
                <p className="ls-home-metric-value">55K+</p>
              </div>
              <div>
                <p className="ls-home-metric-label">Satisfaction</p>
                <p className="ls-home-metric-value">99%</p>
              </div>
              <div>
                <p className="ls-home-metric-label">Growth</p>
                <p className="ls-home-metric-value">300%</p>
              </div>
            </div>

            <div className="ls-home-testimonial-carousel">
              {testimonials.map((t) => (
                <article key={t.id} className="ls-home-testimonial-card">
                  <p className="text-sm text-slate-900">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-4 space-y-1 text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    {(t.title || t.company) && (
                      <p>
                        {t.title}
                        {t.title && t.company && ' · '}
                        {t.company}
                      </p>
                    )}
                    {t.segment && <p className="text-[0.7rem] text-slate-500">{t.segment}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="contact" className="ls-home-footer">
        <div className="ls-home-section-inner ls-home-footer-inner">
          <div className="ls-home-footer-columns">
            <div className="space-y-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-300">
                Let&apos;s explore your property
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                See how LaundroSwipe can plug into your ecosystem.
              </h2>
              <p className="max-w-md text-xs text-slate-600 md:text-[0.85rem]">
                Whether you&apos;re running a residential complex, office, or campus in Kerala or
                Bangalore, we can design a laundry experience that feels effortless for your
                people.
              </p>
              <div className="space-y-2 text-xs text-slate-600">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-[2px] h-3.5 w-3.5 text-rose-500" />
                  <span>
                    F223 DLF NTH SEAPORT AIRPORT ROAD,
                    <br />
                    KOCHI SEZ 682037 · Offices in Kochi &amp; Bangalore
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-emerald-300" />
                  <a href="tel:+917736429562" className="underline decoration-slate-600">
                    +91 77364 29562
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[0.6rem] text-sky-200">
                    @
                  </span>
                  <a
                    href="mailto:support@laundroswipe.com"
                    className="underline decoration-slate-600"
                  >
                    support@laundroswipe.com
                  </a>
                </p>
              </div>
            </div>

            <div>
              <HomeContactForm />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-4 text-[0.7rem] text-slate-500 md:flex-row md:items-center">
            <p>© {new Date().getFullYear()} LaundroSwipe. All rights reserved.</p>
            <div className="flex flex-wrap gap-3">
              <a href="/privacy" className="ls-home-link-button">
                Privacy
              </a>
              <a href="/terms" className="ls-home-link-button">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

