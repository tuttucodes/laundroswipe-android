'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = ['STUDENTS', 'VENDORS', 'ADMINS', 'CAMPUSES'];
const TAB_MEDIA: Record<string, { src: string; alt: string }> = {
  STUDENTS:
    {
      src: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?q=80&w=1200&auto=format&fit=crop',
      alt: 'Student booking on phone',
    },
  VENDORS:
    {
      src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
      alt: 'Laundry operations dashboard',
    },
  ADMINS:
    {
      src: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1200&auto=format&fit=crop',
      alt: 'Admin workflow and analytics',
    },
  CAMPUSES:
    {
      src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop',
      alt: 'Institution campus area',
    },
};

export function FeatureTabs() {
  const [activeTab, setActiveTab] = useState('STUDENTS');

  return (
    <section id="how-it-works" className="w-full bg-white text-black pt-32 pb-24 px-4 md:px-8 relative overflow-hidden">
      <div id="for-institutions" className="absolute top-0" aria-hidden />
      
      {/* Ghost Watermark */}
      <div className="absolute top-0 left-[-5%] text-[150px] md:text-[250px] font-bold text-black/5 pointer-events-none select-none whitespace-nowrap z-0 font-playfair tracking-normal mt-10">
        LaundroSwipe
      </div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-8">
          <div className="flex items-center gap-6">
            <h2 className="font-playfair text-5xl md:text-7xl lg:text-[84px] font-bold tracking-tight uppercase leading-none">
              WHAT WE DO
            </h2>
            <div className="hidden md:block w-24 h-[2px] bg-black/10 mt-4"></div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-6 lg:gap-8 pb-3 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm md:text-base font-bold tracking-[0.15em] whitespace-nowrap pb-2 border-b-2 transition-colors ${
                  activeTab === tab 
                    ? 'border-[#E8523F] text-black' 
                    : 'border-transparent text-gray-400 hover:text-black hover:border-black/20'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content Card container */}
        <div className="w-full bg-[#111111] rounded-[32px] overflow-hidden text-white flex flex-col md:flex-row relative shadow-2xl">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col md:flex-row"
            >
              {/* Left Side: Text Details */}
              <div className="w-full md:w-5/12 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
                <h3 className="text-[#E8523F] font-playfair text-3xl md:text-4xl font-bold mb-6">
                  #{activeTab === 'STUDENTS' ? 'ForStudents' : activeTab === 'VENDORS' ? 'ForVendors' : activeTab === 'ADMINS' ? 'ForAdmins' : 'ForInstitutions'}
                </h3>
                
                <p className="text-[#9CA3AF] text-lg font-sans mb-10 leading-relaxed">
                  {activeTab === 'STUDENTS' && "No more waiting in line or guessing which machine is free. Book your laundry slot in 3 taps, get notified when it's done."}
                  {activeTab === 'VENDORS' && "Manage your entire fleet of machines gracefully. Track revenue, optimize cycles, and handle maintenance seamlessly."}
                  {activeTab === 'ADMINS' && "Oversee everything across multiple dorms. View analytics, reduce wait complaints, and keep standard institution flows."}
                  {activeTab === 'CAMPUSES' && "Bring smart laundry scheduling to your institution with real-time visibility and smooth pickup flows."}
                </p>

                <ul className="space-y-4 font-sans text-sm tracking-wide">
                  <li className="flex items-center gap-4"><div className="w-5 h-5 rounded-full border border-[#E8523F] flex items-center justify-center flex-shrink-0 text-[#E8523F] text-[10px]">✓</div> Real-time Machine Availability</li>
                  <li className="flex items-center gap-4"><div className="w-5 h-5 rounded-full border border-[#E8523F] flex items-center justify-center flex-shrink-0 text-[#E8523F] text-[10px]">✓</div> One-tap Slot Booking</li>
                  <li className="flex items-center gap-4"><div className="w-5 h-5 rounded-full border border-[#E8523F] flex items-center justify-center flex-shrink-0 text-[#E8523F] text-[10px]">✓</div> Smart Reminders & Alerts</li>
                  <li className="flex items-center gap-4"><div className="w-5 h-5 rounded-full border border-[#E8523F] flex items-center justify-center flex-shrink-0 text-[#E8523F] text-[10px]">✓</div> QR Code Check-in</li>
                </ul>
              </div>

              {/* Right Side: Media/Video embedded mock */}
              <div className="w-full md:w-7/12 p-4 md:p-8 flex items-center justify-center bg-black/50 relative">
                 <div className="w-full h-full min-h-[300px] md:min-h-[400px] rounded-2xl bg-zinc-900 border border-white/10 relative overflow-hidden group">
                   <img
                     src={TAB_MEDIA[activeTab]?.src}
                     className="w-full h-full object-cover opacity-55"
                     alt={TAB_MEDIA[activeTab]?.alt ?? 'App preview'}
                   />
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                     <div className="rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 px-6 py-5 text-center shadow-2xl">
                       <div className="text-white font-bold tracking-widest text-lg">
                         {activeTab === 'STUDENTS'
                           ? 'Book in seconds'
                           : activeTab === 'VENDORS'
                             ? 'Partner dashboard'
                             : activeTab === 'ADMINS'
                               ? 'Institution controls'
                               : 'Campus-wide scheduling'}
                       </div>
                       <div className="mt-2 text-white/70 text-sm font-semibold">
                         {activeTab === 'STUDENTS'
                           ? 'Pick a partner. Schedule pickup. Get updates.'
                           : activeTab === 'VENDORS'
                             ? 'Manage orders, capacity, and turnaround.'
                             : activeTab === 'ADMINS'
                               ? 'Visibility across buildings and users.'
                               : 'Operations-ready, scalable workflows.'}
                       </div>
                     </div>
                   </div>
                 </div>
              </div>
            </motion.div>
          </AnimatePresence>
          
          {/* External Nav Arrows overlayed on card */}
          <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 hidden md:flex items-center">
             <button className="w-12 h-12 rounded-full bg-[#111111] border border-white/20 text-white flex items-center justify-center hover:bg-[#E8523F] hover:border-[#E8523F] transition-all shadow-xl -ml-6 z-20">←</button>
          </div>
          <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 hidden md:flex items-center">
             <button className="w-12 h-12 rounded-full bg-[#111111] border border-white/20 text-white flex items-center justify-center hover:bg-[#E8523F] hover:border-[#E8523F] transition-all shadow-xl -mr-6 z-20">→</button>
          </div>

        </div>

      </div>
    </section>
  );
}
