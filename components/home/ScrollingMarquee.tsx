'use client';

import { motion } from 'framer-motion';

export function ScrollingMarquee() {
  const words = [
    "RESIDENTIAL", "EXPRESS DELIVERY", "CORPORATE", "PREMIUM DRY CLEANING", 
    "CAMPUS LAUNDRY", "99% SATISFACTION", "SEAMLESS TRACKING"
  ];
  const duplicatedWords = [...words, ...words, ...words, ...words];

  return (
    <div className="relative flex w-full overflow-hidden bg-[#E63946] py-3 md:py-4">
      <motion.div
        className="flex shrink-0 items-center gap-8 md:gap-12"
        animate={{ x: "-50%" }}
        transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
      >
        {duplicatedWords.map((word, i) => (
          <div key={i} className="flex shrink-0 items-center gap-8 md:gap-12">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-white md:text-lg">
              {word}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
