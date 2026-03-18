'use client';
import { motion } from 'framer-motion';

export function HeroAnimations() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[100dvh] pt-28 pb-20 text-center px-4 md:px-8 z-10 w-full">
      {/* Background Gradient Blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-tr from-[#E63946]/10 via-orange-500/5 to-transparent blur-[100px] -z-10 rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 shadow-sm"
      >
        <span className="flex h-2 w-2 rounded-full bg-[#E63946]"></span>
        <span className="text-xs font-semibold tracking-wide text-zinc-600 uppercase">
          Now delivering in Kochi & Bangalore
        </span>
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-5xl text-5xl font-black tracking-tight text-slate-950 px-2 sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.05]"
      >
        Laundry done <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E63946] to-orange-500">
          in a single swipe.
        </span>
      </motion.h1>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mx-auto mt-8 max-w-2xl text-lg font-medium text-slate-500 sm:text-xl px-4"
      >
        The only laundry partner you'll ever need. We connect you to a vetted network of premium dry cleaners for your home, office, or campus.
      </motion.p>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-14 mb-10 flex flex-col sm:flex-row items-center gap-6"
      >
        <a 
          href="/dashboard" 
          className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-full bg-[#E63946] px-10 py-5 text-lg font-bold text-white shadow-[0_8px_30px_rgba(230,57,70,0.3)] transition-all hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(230,57,70,0.4)] active:scale-95"
        >
          Open Customer App
        </a>
        <a 
          href="#segments" 
          className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-full bg-white px-10 py-5 text-lg font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:bg-slate-50 hover:-translate-y-1 active:scale-95"
        >
          Explore Segments
        </a>
      </motion.div>
    </div>
  );
}
