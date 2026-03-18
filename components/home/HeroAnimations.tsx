'use client';
import { motion } from 'framer-motion';

export function HeroAnimations() {
  return (
    <div className="relative flex flex-col items-center pt-40 md:pt-48 lg:pt-[200px] pb-20 md:pb-32 text-center px-4 md:px-8 z-10 w-full">
      {/* Technical Background Glows */}
      <div className="absolute top-1/2 left-1/2 w-full max-w-4xl h-[500px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-tr from-zinc-800/20 via-[#E63946]/5 to-transparent blur-[120px] -z-10 rounded-[100%] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        className="mb-10 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 shadow-sm backdrop-blur-md"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E63946] opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E63946]"></span>
        </span>
        <span className="text-[11px] font-bold tracking-widest text-zinc-300 uppercase">
          Now delivering in Kochi & Bangalore
        </span>
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-5xl text-5xl font-black tracking-tighter text-white px-2 sm:text-6xl md:text-7xl lg:text-[6rem] leading-[1.05]"
      >
        Laundry done <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500/80">
          in a single swipe.
        </span>
      </motion.h1>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mx-auto mt-8 max-w-2xl text-[1.1rem] font-medium text-zinc-400 sm:text-xl px-4"
      >
        The only laundry partner you'll ever need. We connect you to a vetted network of premium dry cleaners for your home, office, or campus.
      </motion.p>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-12 mb-10 flex flex-col sm:flex-row items-center gap-4"
      >
        <a 
          href="/dashboard" 
          className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-[14px] font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95"
        >
          Open Customer App
        </a>
        <a 
          href="#segments" 
          className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-lg bg-transparent px-8 py-3.5 text-[14px] font-bold text-zinc-300 shadow-sm ring-1 ring-inset ring-white/10 transition-all hover:bg-white/5 hover:-translate-y-1 active:scale-95 hover:text-white"
        >
          Explore Segments
        </a>
      </motion.div>
    </div>
  );
}
