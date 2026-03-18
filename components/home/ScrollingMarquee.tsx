'use client';

import { motion } from 'framer-motion';

export function ScrollingMarquee() {
  const words = [
    "RESIDENTIAL", "EXPRESS DELIVERY", "CORPORATE", "PREMIUM DRY CLEANING", 
    "CAMPUS LAUNDRY", "99% SATISFACTION", "SEAMLESS TRACKING"
  ];
  const duplicatedWords = [...words, ...words, ...words, ...words];

  return (
    <div className="relative z-20 flex w-full overflow-hidden bg-[#E63946] py-5 shadow-[0_-10px_30px_rgba(230,57,70,0.1)]">
      <motion.div
        className="flex shrink-0 items-center gap-10 md:gap-16"
        animate={{ x: "-50%" }}
        transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
      >
        {duplicatedWords.map((word, i) => (
          <div key={i} className="flex shrink-0 items-center gap-10 md:gap-16">
            <span className="text-xs font-black uppercase tracking-[0.25em] text-white/95 md:text-sm">
              {word}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
