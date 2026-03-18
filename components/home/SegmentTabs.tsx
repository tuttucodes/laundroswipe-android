'use client';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const tabs = [
  {
    id: 'residential',
    title: 'RESIDENTIAL',
    content: {
      headline: 'Apartment complexes, gated societies & hostels.',
      desc: 'Fixed pickup windows, society-level pricing, and shared drop points that feel natural to residents.',
      features: ['Daily pickups', 'Ironing', 'Wash & fold'],
    }
  },
  {
    id: 'corporate',
    title: 'CORPORATE',
    content: {
      headline: 'Workplace experience & admin teams.',
      desc: 'Employee convenience programs, executive laundry, and recurring corporate needs – all with one account.',
      features: ['Blazers', 'Executive wear', 'Uniforms'],
    }
  },
  {
    id: 'campus',
    title: 'CAMPUS',
    content: {
      headline: 'Campus-wide laundry at scale.',
      desc: 'Hostels, student apartments, staff quarters – with predictable turnaround and clear communication.',
      features: ['Bulk wash', 'Semester plans', 'Predictable TAT'],
    }
  }
];

export function SegmentTabs() {
  return (
    <div className="w-full">
      <div className="mb-12 flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
        <div className="pl-4 md:pl-0">
          <h2 className="text-4xl font-black tracking-tight text-white uppercase sm:text-5xl text-left">
            WHAT WE DO
          </h2>
          <p className="mt-3 text-zinc-400 text-lg font-medium">Swipe to explore our tailored laundry solutions.</p>
        </div>
      </div>

      {/* Responsive Cards Area */}
      <div className="flex lg:grid lg:grid-cols-3 gap-6 md:gap-8 overflow-x-auto lg:overflow-visible pb-12 pt-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-4 md:px-0">
        {tabs.map((segment, i) => (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="group relative flex min-h-[420px] w-[85vw] md:w-[400px] lg:w-full flex-1 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl bg-[#111113]/80 border border-white/[0.08] p-8 text-white shadow-2xl backdrop-blur-3xl transition-all duration-300 hover:-translate-y-2 hover:border-white/20 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)] md:p-10 cursor-grab active:cursor-grabbing lg:cursor-default"
          >
            {/* Inner Glow Hint */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />

            <div className="relative z-10">
              <span className="mb-6 inline-block rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-black tracking-widest text-zinc-300 ring-1 ring-white/10 shadow-sm">
                {segment.title}
              </span>
              <h3 className="text-2xl font-bold md:text-3xl lg:text-4xl leading-[1.2] tracking-tight mb-4">
                {segment.content.headline}
              </h3>
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
                {segment.content.desc}
              </p>
            </div>

            <div className="relative z-10 mt-auto">
               <div className="flex flex-wrap gap-2.5 mb-8">
                 {segment.content.features.map((feat, j) => (
                   <span key={j} className="rounded-full bg-black/40 px-4 py-2 text-xs font-bold tracking-wide text-zinc-400 ring-1 ring-white/5 backdrop-blur-md">
                     {feat}
                   </span>
                 ))}
               </div>
               
               <button className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-widest text-white transition-colors group-hover:text-zinc-300">
                 Learn more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
               </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
