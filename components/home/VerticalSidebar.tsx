export function VerticalSidebar() {
  return (
    <div className="fixed right-4 top-0 bottom-0 hidden lg:flex flex-col items-end justify-between py-14 z-40 pointer-events-none">
      {/* Top: subtle scroll hint */}
      <div className="pointer-events-none mt-14 flex flex-col items-end gap-5">
        <span className="text-[10px] font-bold tracking-[0.22em] text-black/30 uppercase rotate-90 whitespace-nowrap origin-right">
          Scroll
        </span>
        <div className="h-20 w-px bg-gradient-to-b from-black/15 to-transparent" />
      </div>

      {/* Bottom: LaundroSwipe rail */}
      <div className="mb-6 flex flex-col items-end gap-3">
        <div className="pointer-events-none rotate-90 origin-right whitespace-nowrap rounded-full border border-black/10 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-md">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E8523F]" />
            <span className="text-[9px] font-bold tracking-[0.15em] text-black uppercase">
              Live in Kochi • Bangalore • Chennai
            </span>
          </span>
        </div>

        <a
          href="https://wa.me/917736429562?text=Hi%20LaundroSwipe%2C%20I%27d%20like%20to%20get%20started."
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto rotate-90 origin-right whitespace-nowrap rounded-full bg-black px-4 py-2 text-[9px] font-bold tracking-[0.16em] text-white shadow-lg hover:bg-black/90 transition-colors"
          aria-label="Chat on WhatsApp"
        >
          WhatsApp Us
        </a>
      </div>
    </div>
  );
}
