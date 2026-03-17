'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const tabs = [
  {
    id: 'residential',
    title: 'RESIDENTIAL',
    content: {
      headline: 'Apartment complexes, gated societies & hostels.',
      desc: 'Fixed pickup windows, society-level pricing, and shared drop points that feel natural to residents.',
      features: ['Daily pickups', 'Ironing', 'Wash & fold'],
    }
  },
  {
    id: 'corporate',
    title: 'CORPORATE',
    content: {
      headline: 'Workplace experience & admin teams.',
      desc: 'Employee convenience programs, executive laundry, and recurring corporate needs – all with one account.',
      features: ['Blazers', 'Executive wear', 'Uniforms'],
    }
  },
  {
    id: 'campus',
    title: 'CAMPUS',
    content: {
      headline: 'Campus-wide laundry at scale.',
      desc: 'Hostels, student apartments, staff quarters – with predictable turnaround and clear communication.',
      features: ['Bulk wash', 'Semester plans', 'Predictable TAT'],
    }
  }
];

export function SegmentTabs() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const activeContent = tabs.find(t => t.id === activeTab)?.content;

  return (
    <div className="w-full">
      <div className="mb-12 flex flex-col items-center justify-between gap-8 md:flex-row md:items-end">
        <h2 className="text-5xl font-extrabold tracking-tighter text-white uppercase md:text-7xl lg:text-8xl">
          WHAT WE DO
        </h2>
        
        <div className="flex gap-2 border-b-2 border-zinc-800 pb-2 overflow-x-auto w-full md:w-auto mt-4 md:mt-0 px-2 [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap px-4 py-2 text-xs md:text-sm font-bold tracking-widest transition-colors ${
                activeTab === tab.id ? 'text-[#E63946]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.title}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-[-10px] left-0 h-1 w-full bg-[#E63946]"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-12 min-h-[320px] overflow-hidden rounded-[2rem] bg-zinc-900 border border-zinc-800 p-8 md:p-12 text-white shadow-2xl">
         {/* Background gradient hint */}
         <div className="absolute inset-0 bg-gradient-to-br from-[#E63946]/5 to-transparent pointer-events-none" />
         
         <AnimatePresence mode="wait">
           <motion.div
             key={activeTab}
             initial={{ opacity: 0, y: 15 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -15 }}
             transition={{ duration: 0.3 }}
             className="relative z-10 h-full flex flex-col"
           >
             <h3 className="text-3xl font-bold md:text-4xl lg:text-5xl max-w-2xl leading-[1.15] tracking-tight">
               {activeContent?.headline}
             </h3>
             <p className="mt-6 text-zinc-400 text-base md:text-lg max-w-xl leading-relaxed">
               {activeContent?.desc}
             </p>
             <div className="mt-auto pt-10 flex flex-wrap gap-3">
               {activeContent?.features.map((feat, i) => (
                 <span key={i} className="rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-bold tracking-wide text-zinc-300 ring-1 ring-zinc-800 shadow-sm">
                   {feat}
                 </span>
               ))}
             </div>
           </motion.div>
         </AnimatePresence>
      </div>
    </div>
  );
}
