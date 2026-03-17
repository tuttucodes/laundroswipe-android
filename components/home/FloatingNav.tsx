'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed top-4 z-50 flex w-full justify-center px-4 md:px-8">
      <nav className="relative flex w-full max-w-5xl items-center justify-between rounded-full bg-white/95 px-6 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-md">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-lg md:text-xl font-extrabold tracking-tight text-[#E63946]">LaundroSwipe</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden items-center gap-8 text-sm font-semibold text-slate-500 md:flex">
          <a href="#how" className="hover:text-black transition-colors">How it works</a>
          <a href="#segments" className="hover:text-black transition-colors">Segments</a>
          <a href="#testimonials" className="hover:text-black transition-colors">Stories</a>
        </div>

        {/* CTA */}
        <div className="hidden md:block">
          <a
            href="#contact"
            className="flex items-center justify-center rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white transition-all hover:scale-105 active:scale-95"
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
              <a href="#how" onClick={() => setIsOpen(false)} className="text-lg font-semibold text-slate-800">How it works</a>
              <a href="#segments" onClick={() => setIsOpen(false)} className="text-lg font-semibold text-slate-800">Segments</a>
              <a href="#testimonials" onClick={() => setIsOpen(false)} className="text-lg font-semibold text-slate-800">Stories</a>
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="mt-4 flex w-full justify-center rounded-full bg-black py-3 font-medium text-white"
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
