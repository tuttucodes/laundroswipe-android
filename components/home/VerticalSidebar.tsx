export function VerticalSidebar() {
  return (
    <div
      className="fixed top-0 bottom-0 hidden lg:flex flex-col items-center justify-between z-40 pointer-events-none w-14 py-14
      [right:env(safe-area-inset-right)]"
    >
      {/* Top: subtle scroll hint */}
      <div className="pointer-events-none mt-14 flex flex-col items-center gap-5">
        <span className="text-[10px] font-bold tracking-[0.22em] text-black/30 uppercase whitespace-nowrap [writing-mode:vertical-rl] [text-orientation:mixed]">
          Scroll
        </span>
        <div className="h-20 w-px bg-gradient-to-b from-black/15 to-transparent" />
      </div>

      {/* Bottom: LaundroSwipe rail */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="pointer-events-none rounded-full border border-black/10 bg-white/85 px-3 py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 text-[9px] font-bold tracking-[0.15em] text-black uppercase [writing-mode:vertical-rl] [text-orientation:mixed]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E8523F]" />
            <span>Live in Kochi • Bangalore • Chennai</span>
          </div>
        </div>

        <a
          href="https://wa.me/917736429562?text=Hi%20LaundroSwipe%2C%20I%27d%20like%20to%20get%20started."
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto rounded-full bg-black px-3 py-3 text-[9px] font-bold tracking-[0.16em] text-white shadow-lg hover:bg-black/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 [writing-mode:vertical-rl] [text-orientation:mixed]"
          aria-label="Chat on WhatsApp"
        >
          WhatsApp Us
        </a>
      </div>
    </div>
  );
}
