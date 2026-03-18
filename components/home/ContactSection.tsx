'use client';

import { useState } from 'react';

export function ContactSection() {
  const [userRole, setUserRole] = useState('Student');

  return (
    <section id="contact" className="w-full bg-[#0A0A0A] text-white pt-24 pb-24 px-4 md:px-8 relative overflow-hidden">
      
      {/* Ghost Watermark */}
      <div className="absolute top-[20%] right-[-10%] text-right text-[200px] font-bold text-white/[0.02] pointer-events-none select-none whitespace-nowrap z-0 font-playfair tracking-tighter">
        Get Started
      </div>

      <div className="max-w-[1200px] w-full mx-auto relative z-10 flex flex-col lg:flex-row gap-16 lg:gap-8">
        
        {/* Left Side (40%) */}
        <div className="w-full lg:w-[40%] flex flex-col justify-center">
          <span className="text-[#E8523F] font-sans text-xs uppercase tracking-[0.2em] font-bold mb-4 block">
            {'{ READY TO SWIPE? }'}
          </span>
          <h2 className="font-playfair text-6xl md:text-7xl lg:text-[84px] font-bold tracking-tight mb-8 leading-[1.05]">
            Get<br/>Started
          </h2>
          <p className="text-[#9CA3AF] text-lg font-sans mb-12 max-w-md leading-relaxed">
            Bring LaundroSwipe to your campus. Whether you&apos;re a student, vendor, or campus admin — let&apos;s simplify laundry together.
          </p>

          <div className="flex flex-col gap-2 border-l-2 border-white/10 pl-6">
            <a href="mailto:support@laundroswipe.com" className="text-white hover:text-[#E8523F] font-sans font-bold text-lg transition-colors">
              support@laundroswipe.com
            </a>
            <a href="tel:+917736429562" className="text-white hover:text-[#E8523F] font-sans font-bold text-lg transition-colors">
              +91 7736429562
            </a>
            <a href="#" className="text-zinc-500 hover:text-white font-sans text-sm mt-2 transition-colors">
              WhatsApp Us →
            </a>
          </div>
        </div>

        {/* Right Side (60%) */}
        <div className="w-full lg:w-[60%] flex items-center justify-end">
          <form 
            onSubmit={(e) => e.preventDefault()}
            className="w-full max-w-[600px] bg-[#111111] rounded-[32px] p-8 md:p-12 border border-white/[0.06] shadow-2xl relative overflow-hidden group"
          >
            {/* Subtle glow */}
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/5 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="relative z-10">
              <span className="text-zinc-400 font-sans text-[11px] uppercase tracking-[0.15em] font-bold mb-4 block">
                WHAT ARE YOU?
              </span>
              
              <div className="flex flex-wrap gap-3 mb-10">
                {['Student', 'Vendor', 'Campus Admin'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setUserRole(role)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors border ${
                      userRole === role
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-zinc-400 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-6 font-sans">
                <input 
                  type="text" 
                  placeholder="YOUR NAME" 
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase"
                />
                <input 
                  type="email" 
                  placeholder="YOUR EMAIL" 
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase"
                />
                <input 
                  type="text" 
                  placeholder="YOUR CAMPUS" 
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase"
                />
                <textarea 
                  placeholder="MESSAGE" 
                  rows={3}
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase resize-none mt-2"
                />
              </div>

              <button className="w-full mt-12 bg-[#E8523F] text-white py-5 rounded-full font-bold text-sm tracking-widest uppercase hover:bg-[#c24231] hover:shadow-[0_0_30px_rgba(232,82,63,0.3)] transition-all active:scale-[0.98]">
                Submit
              </button>
            </div>
          </form>
        </div>

      </div>
    </section>
  );
}
