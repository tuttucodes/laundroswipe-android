'use client';

export function Footer() {
  const socials: Array<{ label: string; href: string; short: string }> = [
    { label: 'GitHub', href: 'https://github.com/tuttucodes/laundroswipe', short: 'Gh' },
    { label: 'Instagram', href: 'https://instagram.com/laundroswipe', short: 'In' },
  ];

  const companyLinks: Array<{ label: string; href: string }> = [
    { label: 'About Us', href: '#features' },
    { label: 'Careers', href: 'mailto:support@laundroswipe.com?subject=Careers%20at%20LaundroSwipe' },
    { label: 'Contact', href: '#contact' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ];

  return (
    <footer className="w-full bg-[#f8fafc] text-black pt-20 relative overflow-hidden">
      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-8 relative z-10 flex flex-col">
        
        {/* Top Section */}
        <div className="flex flex-col lg:flex-row justify-between gap-12 lg:gap-8 mb-20">
          
          <div className="w-full lg:w-1/2 flex flex-col">
            <h3 className="font-playfair text-3xl font-bold tracking-tight mb-4 flex items-center gap-2">
              THE LAUNDROSWIPE 🧺
            </h3>
            <p className="font-sans text-zinc-500 max-w-sm">
              Choose your favorite laundry partner and schedule a pickup in a swipe.
            </p>
            
            <div className="flex gap-4 mt-8">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center text-zinc-500 hover:text-black hover:border-black/30 transition-colors"
                >
                  <span className="text-[10px] font-bold uppercase">{social.short}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-1/2 grid grid-cols-2 gap-8 lg:bg-transparent">
            <div className="flex flex-col gap-4">
              <span className="font-sans text-sm font-bold text-zinc-900 mb-2">⚡ Explore</span>
              {['How It Works', 'Features', 'For Institutions'].map(link => (
                <a key={link} href={`#${link.toLowerCase().replace(/\s+/g, '-')}`} className="font-sans text-sm text-zinc-500 hover:text-[#E8523F] transition-colors">{link}</a>
              ))}
            </div>
            
            <div className="flex flex-col gap-4">
              <span className="font-sans text-sm font-bold text-zinc-900 mb-2">🏢 Company</span>
              {companyLinks.map((link) => (
                <a key={link.label} href={link.href} className="font-sans text-sm text-zinc-500 hover:text-[#E8523F] transition-colors">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-black/5 mb-8"></div>

        {/* Bottom Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 font-sans text-[13px] text-zinc-500 pb-16">
          <span>© 2026 LaundroSwipe</span>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> All systems operational</span>
            <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="hover:text-black transition-colors">Back to top ↗</button>
          </div>
        </div>

      </div>

      {/* signature Lanes.gg style upside-down watermark footer */}
      <div className="absolute bottom-[-15%] md:-bottom-24 lg:-bottom-32 left-0 right-0 w-full overflow-hidden flex justify-center pointer-events-none select-none">
         <div className="font-playfair font-black text-[15vw] md:text-[180px] lg:text-[220px] text-zinc-200/50 uppercase tracking-tighter leading-none whitespace-nowrap upside-down opacity-50">
           LAUNDROSWIPE
         </div>
      </div>

    </footer>
  );
}
