import { MapPin, Phone } from 'lucide-react';
import { supabase, hasSupabase } from '@/lib/supabase';
import { HomeContactForm } from '@/components/HomeContactForm';

import { FloatingNav } from '@/components/home/FloatingNav';
import { HeroAnimations } from '@/components/home/HeroAnimations';
import { ScrollingMarquee } from '@/components/home/ScrollingMarquee';
import { SegmentTabs } from '@/components/home/SegmentTabs';
import { TestimonialCarousel } from '@/components/home/TestimonialCarousel';

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
    <main className="min-h-screen bg-[#09090b] selection:bg-white/20 selection:text-white">
      <FloatingNav />

      {/* Hero Section */}
      <section className="relative z-10 bg-[#09090b]" id="how">
         <HeroAnimations />
      </section>

      {/* Marquee Section */}
      <ScrollingMarquee />

      {/* Segments/Tabs Section (Dark Mode) */}
      <section id="segments" className="bg-slate-950 py-24 md:py-32 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <SegmentTabs />
        </div>
      </section>

      {/* Testimonials Section (Dark Mode) */}
      <section id="testimonials" className="bg-[#09090b] py-24 md:py-32 relative">
        <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="absolute inset-0 z-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
          <div className="mb-16 text-center">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400 mb-4">
              [ WHY CLIENTS LOVE US ]
            </p>
            <h2 className="text-5xl font-extrabold tracking-tighter text-white md:text-7xl">
              Testimonials
            </h2>
          </div>
          <TestimonialCarousel testimonials={testimonials} />
        </div>
      </section>

      {/* Footer / Contact (Dark Mode) */}
      <footer id="contact" className="bg-[#09090b] text-white pb-12 relative border-t border-white/5 pt-12">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <div className="grid gap-16 lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.2fr_1fr] items-center">
            <div className="space-y-8 lg:pr-8">
              <h2 className="text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl max-w-xl leading-[1.05]">
                Ready to plug into LaundroSwipe?
              </h2>
              <p className="max-w-md text-zinc-400 text-lg md:text-xl">
                Whether you're running a residential complex, office, or campus, we can design a laundry experience that feels effortless.
              </p>
              
              <div className="mt-12 space-y-6 text-sm font-medium text-zinc-300">
                <div className="flex items-start gap-4">
                  <MapPin className="mt-1 h-6 w-6 shrink-0 text-[#E63946]" />
                  <span className="leading-relaxed">
                    F223 DLF NTH SEAPORT AIRPORT ROAD,<br />
                    KOCHI SEZ 682037 · Offices in Kochi & Bangalore
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Phone className="h-6 w-6 shrink-0 text-[#E63946]" />
                  <a href="tel:+917736429562" className="hover:text-white transition-colors text-lg">
                    +91 77364 29562
                  </a>
                </div>
              </div>
            </div>
            
            <div className="rounded-[2.5rem] bg-zinc-900 border border-zinc-800 p-8 md:p-10 shadow-2xl">
                <HomeContactForm />
            </div>
          </div>
          
          <div className="mt-24 flex flex-col items-center justify-between gap-6 border-t border-zinc-800 pt-8 text-sm font-medium text-zinc-500 md:flex-row">
            <p>© {new Date().getFullYear()} LaundroSwipe. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
