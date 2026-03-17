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
      <div className="flex flex-col justify-between rounded-[2rem] bg-[#0A0A0A] p-8 text-white md:p-12">
        <div className="space-y-12">
          <div>
            <h3 className="text-5xl font-bold tracking-tighter md:text-7xl">55K+</h3>
            <p className="mt-2 text-sm text-zinc-400">Completed Orders</p>
          </div>
          <div>
            <h3 className="text-5xl font-bold tracking-tighter md:text-7xl">99%</h3>
            <p className="mt-2 text-sm text-zinc-400">Client satisfaction rate</p>
          </div>
          <div>
            <h3 className="text-5xl font-bold tracking-tighter md:text-7xl">300%</h3>
            <p className="mt-2 text-sm text-zinc-400">Growth Rate</p>
          </div>
        </div>
      </div>

      {/* Review Card */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-zinc-900 p-8 text-white md:p-12 min-h-[400px]">
        {/* Background Image Setup (Simulated with a dark gradient and floating subtle patterns) */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black opacity-80 mix-blend-multiply" />
        
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
            <p className="text-2xl font-medium leading-snug tracking-tight md:text-4xl">
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
        <div className="relative z-10 mt-10 flex gap-4">
          <button 
            onClick={prev}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button 
            onClick={next}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
