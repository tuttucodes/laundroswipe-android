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
      .from('homepage_testimonials')
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
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/40">
              LS
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide">LaundroSwipe</span>
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                Kerala · Kochi · Bangalore
              </span>
            </div>
          </div>
          <nav className="hidden items-center gap-7 text-xs font-medium text-slate-300 md:flex">
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <a href="#segments" className="hover:text-white">
              For whom
            </a>
            <a href="#testimonials" className="hover:text-white">
              Stories
            </a>
          </nav>
          <Button
            asChild
            size="pill"
            className="hidden rounded-full bg-emerald-400 px-5 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/40 hover:bg-emerald-300 md:inline-flex"
          >
            <a href="#contact">
              Talk to our team
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/40">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-16 pt-10 md:flex-row md:items-center md:px-6 md:pb-20 md:pt-14">
          <div className="flex-1 space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-[0.7rem] font-medium text-slate-300 ring-1 ring-emerald-400/40">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[0.55rem] font-bold text-slate-950">
                ●
              </span>
              2+ years of on-ground operations
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-[1.08] tracking-tight sm:text-[2.5rem] md:text-[3rem]">
              Swiping away the{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
                friction
              </span>{' '}
              from laundry in Kerala.
            </h1>
            <p className="max-w-xl text-sm text-slate-300 md:text-[0.95rem]">
              LaundroSwipe works like a Swiggy or Zomato layer for laundry – connecting customers to
              a vetted network of dry cleaners and partners across homes, offices, and campuses.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="rounded-full bg-emerald-400 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-300"
              >
                <a href="/dashboard" className="flex items-center gap-2">
                  Open customer app
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="pill"
                className="rounded-full border border-slate-700 bg-slate-900/60 px-5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <a href="#segments" className="flex items-center gap-2">
                  Explore for properties
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </a>
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-300 sm:max-w-md">
              <div className="rounded-2xl bg-slate-900/60 p-3 ring-1 ring-slate-800">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-400">Footprint</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">
                  Kochi SEZ &amp; Bangalore
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900/60 p-3 ring-1 ring-slate-800">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-400">Model</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">Platform-first</p>
              </div>
              <div className="rounded-2xl bg-slate-900/60 p-3 ring-1 ring-slate-800">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-400">Segments</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">Homes · Offices · Campus</p>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="mx-auto max-w-sm rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-1 shadow-[0_24px_80px_rgba(8,47,73,0.9)]">
              <div className="rounded-[1.35rem] bg-slate-950/80 p-4">
                <div className="mb-4 flex items-center justify-between text-[0.7rem] text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Live pickup lanes
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[0.65rem] text-slate-200">
                    Swiggy-style cards
                  </span>
                </div>
                <div className="mb-3 flex gap-2 text-xs">
                  <button className="flex-1 rounded-2xl bg-slate-900 px-3 py-2 text-left font-semibold text-slate-100 ring-1 ring-emerald-400/70">
                    Residential
                  </button>
                  <button className="flex-1 rounded-2xl bg-slate-900/40 px-3 py-2 text-left text-slate-300 ring-1 ring-slate-800">
                    Campus
                  </button>
                  <button className="flex-1 rounded-2xl bg-slate-900/40 px-3 py-2 text-left text-slate-300 ring-1 ring-slate-800">
                    Offices
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-sm font-semibold text-slate-950">
                      LS
                    </div>
                    <div className="flex-1 text-xs">
                      <p className="font-semibold text-slate-50">Skyline Heights · Block C</p>
                      <p className="text-[0.7rem] text-slate-400">
                        Daily pickups · Ironing · Wash &amp; fold
                      </p>
                    </div>
                    <span className="self-center rounded-full bg-emerald-500/10 px-2 py-1 text-[0.65rem] font-semibold text-emerald-300">
                      32 mins
                    </span>
                  </div>
                  <div className="flex gap-3 rounded-2xl bg-slate-900/60 p-3 ring-1 ring-slate-800/80">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-emerald-300">
                      DC
                    </div>
                    <div className="flex-1 text-xs">
                      <p className="font-semibold text-slate-50">Premium Dryclean Partner</p>
                      <p className="text-[0.7rem] text-slate-400">
                        Blazers · Sarees · Wedding outfits
                      </p>
                    </div>
                    <span className="self-center rounded-full bg-slate-800 px-2 py-1 text-[0.65rem] font-semibold text-slate-200">
                      1.2 km
                    </span>
                  </div>
                  <p className="mt-2 text-[0.7rem] text-slate-400">
                    This is how LaundroSwipe cards appear inside the app – every card is a verified
                    partner or location.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-slate-800/60 bg-slate-950/60">
        <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-300">
              How LaundroSwipe works
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-[2rem]">
              A Swiggy-style layer, built for laundry.
            </h2>
            <p className="max-w-2xl text-sm text-slate-300 md:text-[0.95rem]">
              We sit between customers and local laundry businesses, standardising discovery,
              logistics, payments, and support – while keeping work with neighbourhood partners.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                01 · Request
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-50">Customer places an order</p>
              <p className="mt-2 text-xs text-slate-300">
                From app or web, with pickup slot, preferences, and property details.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                02 · Smart routing
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-50">
                We match to the right partner
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Based on pin-code, capacity, promised TAT, and services supported.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                03 · Execution
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-50">Pickup to delivery</p>
              <p className="mt-2 text-xs text-slate-300">
                End-to-end handled by our partner network, with updates and quality checks.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                04 · Single window
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-50">One team to talk to</p>
              <p className="mt-2 text-xs text-slate-300">
                For properties and users, LaundroSwipe is the only helpdesk they need.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="segments" className="border-b border-slate-800/60 bg-slate-950">
        <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-300">
              Where we plug in
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-[2rem]">
              One network, multiple property types.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-4 ring-1 ring-slate-800">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[0.7rem] text-emerald-200">
                <Home className="h-3.5 w-3.5" />
                Residential communities
              </div>
              <p className="text-sm font-semibold text-slate-50">
                Apartment complexes, gated societies &amp; hostels.
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Fixed pickup windows, society-level pricing, and shared drop points that feel
                natural to residents.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-[0.7rem] text-amber-200">
                <Building2 className="h-3.5 w-3.5" />
                Corporate offices
              </div>
              <p className="text-sm font-semibold text-slate-50">
                Workplace experience &amp; admin teams.
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Employee convenience programs, executive laundry, and recurring corporate needs –
                all with one LaundroSwipe account.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-[0.7rem] text-sky-200">
                <GraduationCap className="h-3.5 w-3.5" />
                Colleges &amp; institutions
              </div>
              <p className="text-sm font-semibold text-slate-50">Campus-wide laundry at scale.</p>
              <p className="mt-2 text-xs text-slate-300">
                Hostels, student apartments, staff quarters – with predictable turnaround and clear
                communication across cohorts.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="border-b border-slate-800/60 bg-slate-900/80">
        <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-300">
              Why clients stay with us
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-[2rem]">
              Real stories from properties and partners.
            </h2>
            <p className="max-w-xl text-xs text-slate-300 md:text-[0.85rem]">
              Testimonials live in Supabase, so this section can evolve as our network grows – no
              code changes required.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-stretch">
            <div className="flex flex-col justify-between rounded-2xl bg-slate-950 p-5 ring-1 ring-slate-800">
              <div>
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Snapshot
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  We&apos;ve engineered LaundroSwipe to reduce escalation load for property teams
                  while keeping end-users delighted.
                </p>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-2xl bg-slate-900 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">
                    Completed orders
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">55K+</p>
                </div>
                <div className="rounded-2xl bg-slate-900 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">
                    Satisfaction
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">99%</p>
                </div>
                <div className="rounded-2xl bg-slate-900 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">
                    Growth
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">300%</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {testimonials.map((t) => (
                <article
                  key={t.id}
                  className="flex flex-col justify-between rounded-2xl bg-slate-950/90 p-4 ring-1 ring-slate-800"
                >
                  <p className="text-sm text-slate-100">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-4 space-y-1 text-xs text-slate-300">
                    <p className="font-semibold text-slate-50">{t.name}</p>
                    {(t.title || t.company) && (
                      <p>
                        {t.title}
                        {t.title && t.company && ' · '}
                        {t.company}
                      </p>
                    )}
                    {t.segment && <p className="text-[0.7rem] text-slate-400">{t.segment}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-slate-950">
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-300">
                Let&apos;s explore your property
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">
                See how LaundroSwipe can plug into your ecosystem.
              </h2>
              <p className="max-w-md text-xs text-slate-300 md:text-[0.85rem]">
                Whether you&apos;re running a residential complex, office, or campus in Kerala or
                Bangalore, we can design a laundry experience that feels effortless for your people.
              </p>
              <div className="space-y-2 text-xs text-slate-300">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-[2px] h-3.5 w-3.5 text-emerald-300" />
                  <span>
                    F223 DLF NTH SEAPORT AIRPORT ROAD,
                    <br />
                    KOCHI SEZ 682037 · Offices in Kochi &amp; Bangalore
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-emerald-300" />
                  <a href="tel:+917736429562" className="underline decoration-slate-500">
                    +91 77364 29562
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[0.6rem] text-sky-200">
                    @
                  </span>
                  <a
                    href="mailto:support@laundroswipe.com"
                    className="underline decoration-slate-500"
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
          <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-slate-800 pt-4 text-[0.7rem] text-slate-500 md:flex-row md:items-center">
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

