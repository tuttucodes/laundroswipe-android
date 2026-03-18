'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';

type Testimonial = {
  id: number;
  quote: string;
  name: string;
  title?: string;
  company?: string;
  segment?: string;
};

export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const [index, setIndex] = useState(0);

  const next = () => setIndex((i) => (i + 1) % testimonials.length);
  const prev = () => setIndex((i) => (i - 1 + testimonials.length) % testimonials.length);

  const current = testimonials[index];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
      {/* Stats Card */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#111113]/80 border border-white/[0.08] p-8 text-white shadow-2xl backdrop-blur-3xl md:p-12 group">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
        <div className="space-y-12 relative z-10">
          <div>
            <h3 className="text-6xl font-black tracking-tighter md:text-7xl lg:text-[5.5rem] leading-[1]">55K+</h3>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-zinc-400">Completed Orders</p>
          </div>
          <div>
            <h3 className="text-6xl font-black tracking-tighter md:text-7xl lg:text-[5.5rem] leading-[1]">99%</h3>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-zinc-400">Client satisfaction</p>
          </div>
          <div>
            <h3 className="text-6xl font-black tracking-tighter md:text-7xl lg:text-[5.5rem] leading-[1]">300%</h3>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-zinc-400">Growth Rate</p>
          </div>
        </div>
      </div>

      {/* Review Card */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/[0.08] p-8 text-white md:p-12 min-h-[450px] shadow-2xl">
        {/* Background Image Setup (Simulated with a dark gradient and floating subtle patterns) */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
        
        <div className="relative z-10 text-sm font-bold tracking-widest text-zinc-500">
          0{index + 1} / 0{testimonials.length}
        </div>

        <div className="relative z-10 mt-auto">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-3xl font-bold leading-tight tracking-tight md:text-5xl text-white/95">
              &ldquo;{current.quote}&rdquo;
            </p>
            <div className="mt-8">
              <p className="font-bold text-white">{current.name}</p>
              <p className="text-sm text-zinc-400">
                {current.title} {current.company ? `, ${current.company}` : ''}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Navigation Arrows */}
        <div className="relative z-10 mt-12 flex gap-4">
          <button 
            onClick={prev}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 shadow-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button 
            onClick={next}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 shadow-lg"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
