'use client';

import { motion } from 'framer-motion';

export function Hero() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  const pillAnim = {
    hidden: { scale: 0, opacity: 0 },
    show: { scale: 1, opacity: 1, transition: { duration: 0.5, ease: 'backOut' } },
  };

  return (
    <section className="relative w-full min-h-screen flex flex-col items-center justify-center pt-24 pb-12 px-4 md:px-8 bg-white overflow-hidden">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-[1200px] w-full mx-auto text-center flex flex-col items-center z-10"
      >
        <h1 className="font-playfair text-[11vw] sm:text-[72px] md:text-[84px] lg:text-[100px] leading-[1.05] tracking-tight uppercase font-extrabold text-black">
          <motion.div variants={item} className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 lg:gap-x-5">
            <span>SCHEDULE YOUR</span>
            <motion.div variants={pillAnim} className="w-[10vw] sm:w-[80px] lg:w-[120px] aspect-[2.5/1] rounded-full bg-zinc-200 overflow-hidden relative shadow-inner inline-block align-middle transform -translate-y-1">
               <img src="https://images.unsplash.com/photo-1545173168-9f1947eebb7f?q=80&w=400&auto=format&fit=crop" alt="Washing Machine" className="w-full h-full object-cover" />
            </motion.div>
            <span className="text-[#E8523F]">LAUNDRY</span>
          </motion.div>

          <motion.div variants={item} className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 lg:gap-x-5 mt-1 lg:-mt-2">
            <span>IN</span>
            <motion.div variants={pillAnim} className="w-[12vw] sm:w-[90px] lg:w-[140px] aspect-[2.5/1] rounded-full bg-zinc-200 overflow-hidden relative shadow-inner inline-block align-middle transform -translate-y-1">
               <img src="https://images.unsplash.com/photo-1512314889357-e157c22f938d?q=80&w=400&auto=format&fit=crop" alt="App Usage" className="w-full h-full object-cover" />
            </motion.div>
            <span>SECONDS</span>
          </motion.div>

          <motion.div variants={item} className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 lg:gap-x-5 mt-1 lg:-mt-2">
            <span className="text-[#E8523F]">A CAMPUS</span>
            <motion.div variants={pillAnim} className="w-[14vw] sm:w-[100px] lg:w-[160px] aspect-[2.5/1] rounded-full bg-zinc-200 overflow-hidden relative shadow-inner inline-block align-middle transform -translate-y-1 group cursor-pointer">
               <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=400&auto=format&fit=crop" alt="Campus Building" className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" />
               <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                 <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center pl-0.5">
                   <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 lg:w-4 lg:h-4 text-black">
                     <path d="M8 5v14l11-7z" />
                   </svg>
                 </div>
               </div>
            </motion.div>
            <span>EXPERIENCE</span>
          </motion.div>

          <motion.div variants={item} className="mt-1 lg:-mt-2 text-[#E8523F]">
            WORTH SWIPING
          </motion.div>
        </h1>

        <motion.p variants={item} className="mt-10 lg:mt-12 text-zinc-500 font-sans text-base sm:text-lg lg:text-xl max-w-xl">
          The only laundry app your campus will ever need.
        </motion.p>

        <motion.div variants={item} className="mt-12 lg:mt-16">
          <a href="#how-it-works" className="inline-flex items-center gap-2 px-8 py-4 bg-white border border-zinc-200 hover:border-zinc-300 rounded-full text-black font-semibold text-sm tracking-wide transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95">
            <span className="text-lg leading-none">✨</span> SEE HOW IT WORKS
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
