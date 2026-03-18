'use client';

import { motion } from 'framer-motion';

export function Testimonials() {
  return (
    <section className="w-full bg-white text-black pt-24 pb-16 px-4 md:px-8 relative overflow-hidden">
      
      {/* Ghost Watermark */}
      <div className="absolute top-[10%] left-0 right-0 text-center text-[12vw] font-bold text-black/[0.03] pointer-events-none select-none z-0 font-playfair tracking-tighter w-full">
        Testimonials
      </div>

      <div className="max-w-[1200px] mx-auto relative z-10 flex flex-col items-center">
        
        {/* Header */}
        <span className="text-zinc-400 font-sans text-xs uppercase tracking-[0.2em] font-bold mb-4 block text-center">
          {'{ WHY STUDENTS LOVE US }'}
        </span>
        <h2 className="font-playfair text-5xl md:text-7xl lg:text-[84px] font-bold tracking-tight mb-16 text-center">
          Testimonials
        </h2>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full h-full md:h-[600px]">
          
          {/* Left Stats Card */}
          <div className="md:col-span-4 bg-black rounded-[32px] p-10 md:p-12 flex flex-col justify-center gap-12 text-white shadow-2xl relative overflow-hidden group">
            {/* Subtle highlight glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="relative z-10 space-y-10">
              <div className="space-y-1">
                <div className="font-playfair text-5xl font-bold tracking-tighter">5000+</div>
                <div className="text-zinc-400 font-sans text-sm tracking-wide">Active Users</div>
              </div>
              <div className="space-y-1">
                <div className="font-playfair text-5xl font-bold tracking-tighter">98%</div>
                <div className="text-zinc-400 font-sans text-sm tracking-wide">On-time Pickup Rate</div>
              </div>
              <div className="space-y-1">
                <div className="font-playfair text-5xl font-bold tracking-tighter">4.8★</div>
                <div className="text-zinc-400 font-sans text-sm tracking-wide">Average Rating</div>
              </div>
            </div>
          </div>

          {/* Right Quote Card (Image Background) */}
          <div className="md:col-span-8 bg-[#111111] rounded-[32px] relative overflow-hidden shadow-2xl group flex flex-col justify-between p-10 md:p-12 min-h-[400px]">
            {/* Image Overlay */}
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay transition-transform duration-[10s] group-hover:scale-105" alt="Students" />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/40 to-transparent"></div>

            {/* Counter */}
            <div className="relative z-10 text-white/50 font-mono text-sm tracking-widest uppercase">
              01 / 03
            </div>

            {/* Quote content */}
            <div className="relative z-10 mt-auto">
              <h3 className="font-playfair text-3xl md:text-5xl lg:text-[56px] font-bold text-white leading-[1.1] mb-8 lg:max-w-3xl">
                "LaundroSwipe literally saved my hostel life. No more fights over machines. Just book, wash, done."
              </h3>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex flex-col">
                  <span className="text-white font-bold font-sans text-lg">Priya Menon</span>
                  <span className="text-zinc-400 font-sans text-sm">3rd Year, SRM KTR</span>
                </div>
                
                {/* Arrow Navigation */}
                <div className="flex gap-3">
                  <button className="w-12 h-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors">←</button>
                  <button className="w-12 h-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors">→</button>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
