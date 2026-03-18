export function VerticalSidebar() {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-16 hidden lg:flex flex-col items-center justify-between py-12 z-50 mix-blend-difference">
      {/* Top SCROLL indicator */}
      <div className="flex flex-col items-center gap-6 mt-16">
        <span className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase rotate-90 whitespace-nowrap origin-center translate-x-[2px]">
          Scroll
        </span>
        <div className="w-[1px] h-16 bg-gradient-to-b from-white/20 to-transparent mt-4"></div>
      </div>

      {/* Bottom OPEN TO PROJECTS indicator */}
      <div className="flex flex-col items-center gap-4 mb-2">
        <div className="flex items-center gap-2 rotate-90 origin-center whitespace-nowrap bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8523F] animate-pulse"></span>
          <span className="text-[9px] font-bold tracking-[0.15em] text-white uppercase">
            Open to Projects
          </span>
        </div>
      </div>
    </div>
  );
}
