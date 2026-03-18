'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed top-6 z-50 flex w-full justify-center px-4 md:px-8">
      <nav className="relative flex w-full max-w-5xl items-center justify-between rounded-full bg-white/90 px-6 py-3.5 shadow-xl shadow-black/5 backdrop-blur-xl border border-zinc-200/40">
        {/* Logo */}
        <div className="flex items-center gap-2 pl-2 md:pl-0">
          <span className="text-xl md:text-[1.35rem] font-black tracking-[-.02em] text-[#E63946] leading-none">LaundroSwipe</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden items-center gap-10 text-[15px] font-bold text-slate-600 md:flex">
          <a href="#how" className="hover:text-[#E63946] transition-colors">How it works</a>
          <a href="#segments" className="hover:text-[#E63946] transition-colors">Segments</a>
          <a href="#testimonials" className="hover:text-[#E63946] transition-colors">Stories</a>
        </div>

        {/* CTA */}
        <div className="hidden md:block pr-1 md:pr-0">
          <a
            href="#contact"
            className="flex items-center justify-center rounded-full bg-[#E63946] px-7 py-3 text-[15px] font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-md shadow-[#E63946]/20 hover:bg-[#E63946]/90"
          >
            Contact
          </a>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="text-black md:hidden" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl md:hidden"
          >
            <div className="flex flex-col space-y-4 p-6">
              <a href="#how" onClick={() => setIsOpen(false)} className="text-lg font-bold text-slate-800 hover:text-[#E63946]">How it works</a>
              <a href="#segments" onClick={() => setIsOpen(false)} className="text-lg font-bold text-slate-800 hover:text-[#E63946]">Segments</a>
              <a href="#testimonials" onClick={() => setIsOpen(false)} className="text-lg font-bold text-slate-800 hover:text-[#E63946]">Stories</a>
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="mt-4 flex w-full justify-center rounded-full bg-[#E63946] py-3.5 text-[15px] font-bold text-white shadow-md shadow-[#E63946]/20"
              >
                Contact
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
