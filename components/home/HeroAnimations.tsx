'use client';
import { motion } from 'framer-motion';

export function HeroAnimations() {
  return (
    <div className="flex flex-col items-center pt-40 pb-20 text-center px-4 md:px-6">
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl text-[12vw] leading-[0.85] font-black tracking-tighter text-slate-950 md:text-[8rem] lg:text-[10rem] uppercase"
      >
        <div className="flex justify-center items-center flex-wrap gap-x-4 md:gap-x-6">
          <span>SWIPING</span>
          <span className="text-zinc-300">AWAY</span>
        </div>
        <div className="flex justify-center items-center flex-wrap gap-x-4 md:gap-x-6">
          <span className="text-zinc-300">THE</span>
          <span className="relative inline-flex h-[0.65em] w-[1.4em] items-center justify-center overflow-hidden rounded-full bg-slate-900 border-[6px] border-white align-baseline shadow-xl">
             {/* A stylish play-button pill inside the text */}
             <div className="h-full w-full bg-slate-900 flex items-center justify-center">
                <div className="h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-white ml-1" />
             </div>
          </span>
          <span className="text-[#E63946]">FRICTION</span>
        </div>
        <div className="flex justify-center items-center flex-wrap gap-x-4 md:gap-x-6">
          <span className="text-zinc-300">OF</span>
          <span>LAUNDRY</span>
        </div>
      </motion.h1>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mx-auto mt-12 max-w-xl text-lg font-medium text-slate-500"
      >
        The only laundry partner you'll ever need. Connecting customers to a vetted network across homes, offices, and campuses.
      </motion.p>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-12"
      >
        <a 
          href="/dashboard" 
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-bold tracking-[0.15em] text-[#E63946] shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md hover:-translate-y-0.5"
        >
          <span className="text-xl leading-none">✨</span>
          OPEN CUSTOMER APP
        </a>
      </motion.div>
    </div>
  );
}
