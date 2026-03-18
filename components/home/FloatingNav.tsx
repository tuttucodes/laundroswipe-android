'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 md:px-8 mix-blend-normal">
      <nav 
        className={`relative flex w-full max-w-[1200px] items-center justify-between rounded-[50px] px-5 sm:px-6 py-3 transition-all duration-300 ${
          scrolled 
            ? 'bg-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl border border-black/5' 
            : 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-black/5'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-[#E8523F] leading-none mix-blend-normal">LaundroSwipe</span>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-6">
          {['How It Works', 'Features', 'For Campuses', 'Pricing'].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-[13px] font-semibold text-black hover:text-[#E8523F] transition-colors uppercase tracking-[0.08em] whitespace-nowrap">
              {item}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:block shrink-0">
          <a
            href="#contact"
            className="flex items-center justify-center rounded-full bg-black px-6 py-3 text-[13px] font-bold text-white transition-transform hover:scale-105 active:scale-95 shadow-md whitespace-nowrap"
          >
            Get Started
          </a>
        </div>

        {/* Mobile Hamburger */}
        <button 
          className="text-black lg:hidden p-1" 
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
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-16 w-[calc(100%-2rem)] max-w-[1200px] overflow-hidden rounded-3xl bg-white shadow-2xl border border-black/5 lg:hidden"
          >
            <div className="flex flex-col space-y-2 p-6">
              {['How It Works', 'Features', 'For Campuses', 'Pricing'].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setIsOpen(false)} className="text-lg font-bold text-black hover:text-[#E8523F] py-2 uppercase tracking-tight">
                  {item}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="mt-4 flex w-full justify-center rounded-full bg-[#E8523F] py-4 text-[15px] font-bold text-white shadow-xl shadow-[#E8523F]/20 active:scale-95 transition-transform"
              >
                Get Started
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
