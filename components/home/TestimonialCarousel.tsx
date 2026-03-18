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
      <div className="relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-zinc-900 border border-zinc-800 p-8 text-white shadow-2xl md:p-12 group">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#E63946]/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
        <div className="space-y-12 relative z-10">
          <div>
            <h3 className="text-6xl font-black tracking-tighter md:text-7xl lg:text-[5.5rem] leading-[1]">55K+</h3>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-[#E63946]">Completed Orders</p>
          </div>
          <div>
            <h3 className="text-6xl font-black tracking-tighter md:text-7xl lg:text-[5.5rem] leading-[1]">99%</h3>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-[#E63946]">Client satisfaction</p>
          </div>
          <div>
            <h3 className="text-6xl font-black tracking-tighter md:text-7xl lg:text-[5.5rem] leading-[1]">300%</h3>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-[#E63946]">Growth Rate</p>
          </div>
        </div>
      </div>

      {/* Review Card */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 p-8 text-white md:p-12 min-h-[450px] shadow-2xl">
        {/* Background Image Setup (Simulated with a dark gradient and floating subtle patterns) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#E63946]/5 to-black/40 pointer-events-none" />
        
        <div className="relative z-10 text-sm font-medium tracking-widest text-[#E63946]">
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
              "{current.quote}"
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
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-all hover:bg-white hover:text-black hover:scale-110 active:scale-95 shadow-lg"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <button 
            onClick={next}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-all hover:bg-white hover:text-black hover:scale-110 active:scale-95 shadow-lg"
          >
            <ArrowRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
