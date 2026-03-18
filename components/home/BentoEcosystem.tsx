'use client';

import { motion } from 'framer-motion';

export function BentoEcosystem() {
  return (
    <section id="features" className="w-full bg-[#0A0A0A] text-white pt-32 pb-32 px-4 md:px-8">
      <div className="max-w-[1200px] w-full mx-auto">
        
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32 min-h-[400px]">
          
          {/* Card 1: Notifications */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-1 bg-[#1A1A1A] rounded-3xl p-8 border border-white/[0.06] flex flex-col justify-between overflow-hidden relative group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#E8523F]/10 blur-[80px] rounded-full group-hover:bg-[#E8523F]/20 transition-colors duration-700"></div>
            <div className="flex gap-4 mb-12">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/10">📱</div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/10">🔔</div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/10">⚡</div>
            </div>
            <div className="relative z-10">
              <div className="text-xl font-sans font-bold leading-tight mb-2">Smart Notifications & Reminders</div>
              <p className="text-[#9CA3AF] text-sm">Never miss your cycle. Get real-time alerts.</p>
            </div>
          </motion.div>

          {/* Card 2: Dashboard UI + Center Overlay */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="md:col-span-2 bg-[#1A1A1A] rounded-3xl p-8 border border-white/[0.06] flex flex-col items-center justify-center relative overflow-hidden group"
          >
            {/* Abstract UI UI Simulation */}
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]"></div>
            
            {/* Center Glass Overlay */}
            <div className="relative z-20 flex flex-col items-center justify-center text-center p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <span className="text-[#E8523F] font-sans text-[11px] uppercase tracking-[0.2em] font-bold mb-3 block">
                {'{ PLATFORM }'}
              </span>
              <h2 className="font-playfair text-4xl md:text-5xl font-bold mb-2 tracking-tight">LaundroSwipe</h2>
              <p className="text-[#9CA3AF] font-sans text-sm md:text-base">Simplifying laundry pickups</p>
            </div>
          </motion.div>

        </div>

        {/* The Ecosystem 3-Column Layout */}
        <div className="mb-8">
          <span className="text-[#E8523F] font-sans text-xs uppercase tracking-[0.15em] font-bold mb-4 block text-center md:text-left">
            {'{ THE LAUNDROSWIPE ECOSYSTEM }'}
          </span>
          <h2 className="font-playfair text-4xl md:text-5xl lg:text-[64px] font-bold tracking-tight mb-16 text-center md:text-left">
            Simplifying Laundry Pickups
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 lg:gap-12">
            
            {/* Column 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group"
            >
              <h3 className="text-xl font-bold font-sans mb-4 group-hover:text-[#E8523F] transition-colors">laundroswipe institutions</h3>
              <ul className="space-y-3 text-[#9CA3AF] text-[15px]">
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Scheduling</li>
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Real-time Machine Status</li>
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Notifications</li>
              </ul>
            </motion.div>

            {/* Column 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group"
            >
              <h3 className="text-xl font-bold font-sans mb-4 group-hover:text-[#E8523F] transition-colors">laundroswipe vendor</h3>
              <ul className="space-y-3 text-[#9CA3AF] text-[15px]">
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Vendor Dashboard</li>
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Revenue Tracking</li>
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Machine Management</li>
              </ul>
            </motion.div>

            {/* Column 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group"
            >
              <h3 className="text-xl font-bold font-sans mb-4 group-hover:text-[#E8523F] transition-colors">laundroswipe admin</h3>
              <ul className="space-y-3 text-[#9CA3AF] text-[15px]">
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Institution Analytics</li>
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Multi-institution Support</li>
                <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">•</span> Admin Controls</li>
              </ul>
            </motion.div>

          </div>
        </div>

      </div>
    </section>
  );
}
