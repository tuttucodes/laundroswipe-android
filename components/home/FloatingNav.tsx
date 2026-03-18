'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 w-full z-50 flex justify-center border-b border-white/[0.08] bg-[#09090b]/80 backdrop-blur-xl">
      <nav className="relative flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-[1.35rem] font-bold tracking-tight text-white leading-none">LaundroSwipe</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden items-center gap-8 text-[14px] font-medium text-zinc-400 md:flex">
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#segments" className="hover:text-white transition-colors">Segments</a>
          <a href="#testimonials" className="hover:text-white transition-colors">Stories</a>
        </div>

        {/* CTA */}
        <div className="hidden md:block">
          <a
            href="#contact"
            className="flex items-center justify-center rounded-md bg-white px-6 py-2 text-[13px] font-semibold text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)]"
          >
            Contact
          </a>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="text-white md:hidden" 
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
            className="absolute top-16 w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl bg-zinc-950/95 border border-white/10 shadow-2xl backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col space-y-4 p-6">
              <a href="#how" onClick={() => setIsOpen(false)} className="text-lg font-medium text-zinc-300 hover:text-white">How it works</a>
              <a href="#segments" onClick={() => setIsOpen(false)} className="text-lg font-medium text-zinc-300 hover:text-white">Segments</a>
              <a href="#testimonials" onClick={() => setIsOpen(false)} className="text-lg font-medium text-zinc-300 hover:text-white">Stories</a>
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="mt-4 flex w-full justify-center rounded-lg bg-white py-3 text-[14px] font-semibold text-black shadow-lg shadow-white/5"
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
