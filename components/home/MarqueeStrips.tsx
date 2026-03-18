'use client';

import { motion } from 'framer-motion';

export function MarqueeStrips() {
  const strip1Text = "REAL-TIME SCHEDULING • SMART NOTIFICATIONS • QR CODE CHECK-IN • VENDOR DASHBOARD • CAMPUS ANALYTICS • ZERO WAITING • ";
  const strip2Text = "TRUSTED BY MANY • PARTNERING WITH CAMPUSES ACROSS INDIA • EXPANDING NATIONWIDE • ";

  return (
    <div className="w-full flex flex-col">
      {/* Strip 1 - Accent Coral Background */}
      <div className="w-full bg-[#E8523F] text-white py-6 md:py-8 overflow-hidden flex whitespace-nowrap border-y border-[#E8523F]">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, ease: "linear", duration: 25 }}
          className="flex whitespace-nowrap items-center"
        >
          <span className="text-3xl md:text-5xl font-sans font-bold tracking-tight uppercase mx-4 pt-1">
            {strip1Text}{strip1Text}{strip1Text}{strip1Text}
          </span>
        </motion.div>
      </div>

      {/* Strip 2 - Black Background */}
      <div className="w-full bg-[#0A0A0A] text-white py-6 md:py-8 overflow-hidden flex whitespace-nowrap border-b border-white/[0.06]">
        <motion.div
          animate={{ x: ["-50%", "0%"] }}
          transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
          className="flex whitespace-nowrap items-center"
        >
          <span className="text-3xl md:text-5xl font-sans font-bold tracking-tight uppercase mx-4 opacity-80 pt-1">
            {strip2Text}{strip2Text}{strip2Text}{strip2Text}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
