'use client';

import { motion } from 'framer-motion';

export function ScrollingMarquee() {
  const words = [
    "RESIDENTIAL", "EXPRESS DELIVERY", "CORPORATE", "PREMIUM DRY CLEANING", 
    "CAMPUS LAUNDRY", "99% SATISFACTION", "SEAMLESS TRACKING"
  ];
  const duplicatedWords = [...words, ...words, ...words, ...words];

  return (
    <div className="relative z-20 flex w-full overflow-hidden bg-[#09090b] py-6 shadow-[-10px_-20px_40px_rgba(0,0,0,0.8)] border-y border-white/5">
      <motion.div
        className="flex shrink-0 items-center gap-10 md:gap-16"
        animate={{ x: "-50%" }}
        transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
      >
        {duplicatedWords.map((word, i) => (
          <div key={i} className="flex shrink-0 items-center gap-10 md:gap-16">
              <span className="text-4xl font-extrabold tracking-widest text-transparent uppercase md:text-5xl [-webkit-text-stroke:1px_rgba(255,255,255,0.15)] hover:[-webkit-text-stroke:1px_rgba(255,255,255,0.8)] transition-all duration-300">
                {word}
              </span>
              {i < duplicatedWords.length - 1 && (
                <span className="h-2 w-2 rounded-full bg-zinc-800" />
              )}</div>
        ))}
      </motion.div>
    </div>
  );
}
