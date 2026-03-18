'use client';

import { motion } from 'framer-motion';

export function BentoEcosystem() {
  return (
    <section id="features" className="w-full bg-[#0A0A0A] text-white pt-32 pb-32 px-4 md:px-8">
      <div className="max-w-[1200px] w-full mx-auto">
        
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-28">
          
          {/* Card 1: Notifications */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-1 bg-[#111113]/80 rounded-3xl p-8 border border-white/[0.08] flex flex-col justify-between overflow-hidden relative group shadow-2xl backdrop-blur-3xl transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#E8523F]/10 blur-[80px] rounded-full group-hover:bg-[#E8523F]/20 transition-colors duration-700" />
            <div className="flex gap-4 mb-12">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/10">📱</div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/10">🔔</div>
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/10">⚡</div>
            </div>
            <div className="relative z-10">
              <div className="text-xl font-sans font-bold leading-tight mb-2">Smart Notifications & Reminders</div>
              <p className="text-[#9CA3AF] text-sm">Never miss your cycle. Get real-time alerts.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Pickup reminders', 'Order updates', 'Partner ETA'].map((x) => (
                  <span key={x} className="rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 2: Dashboard UI + Center Overlay */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="md:col-span-2 bg-[#111113]/80 rounded-3xl p-8 border border-white/[0.08] flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl backdrop-blur-3xl transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
            {/* Abstract UI Simulation */}
            <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#E8523F]/10 blur-[80px] transition-opacity duration-700 opacity-60 group-hover:opacity-90" />
            <div className="absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-white/5 blur-[90px] transition-opacity duration-700 opacity-50 group-hover:opacity-80" />
            
            {/* Center Glass Overlay */}
            <div className="relative z-20 flex flex-col items-center justify-center text-center p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <span className="text-[#E8523F] font-sans text-[11px] uppercase tracking-[0.2em] font-bold mb-3 block">
                {'{ PLATFORM }'}
              </span>
              <h2 className="font-playfair text-4xl md:text-5xl font-bold mb-2 tracking-tight">LaundroSwipe</h2>
              <p className="text-[#9CA3AF] font-sans text-sm md:text-base">Simplifying laundry pickups</p>
              <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-3">
                {[
                  { k: 'Choose', v: 'Partner' },
                  { k: 'Schedule', v: 'Pickup' },
                  { k: 'Track', v: 'Status' },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-left">
                    <div className="text-[10px] font-bold tracking-[0.18em] text-white/60 uppercase">{s.k}</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 3: Partner selection / pickup flow */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="md:col-span-3 bg-[#111113]/80 rounded-3xl p-8 md:p-10 border border-white/[0.08] relative overflow-hidden group shadow-2xl backdrop-blur-3xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-40 w-[560px] max-w-[90%] rounded-full bg-[#E8523F]/10 blur-[80px] opacity-70" />

            <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <div className="text-[#E8523F] font-sans text-[11px] uppercase tracking-[0.2em] font-bold">
                  {'{ PICK YOUR PARTNER }'}
                </div>
                <h3 className="mt-3 font-playfair text-3xl md:text-4xl font-bold tracking-tight">
                  Your favorite laundry partner, one swipe away.
                </h3>
                <p className="mt-4 text-[#9CA3AF] text-sm md:text-base leading-relaxed">
                  Compare partners, select turnaround that fits your day, and schedule pickups in seconds — with updates end-to-end.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {['Kochi', 'Bangalore', 'Chennai'].map((city) => (
                    <span key={city} className="rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
                      Live in {city}
                    </span>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-[520px]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { title: 'Jos Brothers', badge: 'Trusted', tone: 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/20' },
                    { title: 'TumbleDry', badge: 'Same-day', tone: 'bg-[#E8523F]/10 text-[#ffb2aa] ring-[#E8523F]/25' },
                    { title: 'QuickFold', badge: 'Best value', tone: 'bg-white/5 text-white/80 ring-white/10' },
                  ].map((p) => (
                    <a
                      key={p.title}
                      href="/dashboard"
                      className="rounded-2xl bg-black/35 ring-1 ring-white/10 border border-white/5 px-4 py-4 transition-transform duration-300 hover:-translate-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-bold text-white/90">{p.title}</div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ring-1 ${p.tone}`}>
                          {p.badge}
                        </span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#E8523F] to-white/20" />
                      </div>
                      <div className="mt-3 text-[11px] font-semibold text-white/60">
                        Click to schedule pickup →
                      </div>
                    </a>
                  ))}
                </div>
              </div>
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
