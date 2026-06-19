import React, { useMemo, useEffect, useState, useRef } from 'react';
import { parseLRC } from '../../lib/lyrics';

// ── Adaptive accent color: ensure contrast against dark scene ─────
function ensureContrast(hex: string): string {
  // Parse hex to RGB
  let r = 0, g = 0, b = 0;
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else if (h.length === 6) {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    }
  }
  // Relative luminance (sRGB)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // If too bright (luminance > 0.7), darken by reducing to 40% lightness
  if (lum > 0.7) {
    const factor = 0.4 / Math.max(lum, 0.01);
    r = Math.min(255, Math.round(r * factor));
    g = Math.min(255, Math.round(g * factor));
    b = Math.min(255, Math.round(b * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  // Boost saturation by pulling away from grey for low-lum colors
  if (lum < 0.2) {
    const boost = 1.3;
    const avg = (r + g + b) / 3;
    r = Math.min(255, Math.round(avg + (r - avg) * boost));
    g = Math.min(255, Math.round(avg + (g - avg) * boost));
    b = Math.min(255, Math.round(avg + (b - avg) * boost));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return hex;
}

interface LyricsDisplayProps {
  lrcText: string;
  currentTime: number;
  accentHex?: string;
  isPlaying?: boolean;
  isMobile?: boolean;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lrcText, currentTime, accentHex = '#00ffff', isPlaying = true, isMobile = false
}) => {
  const safeAccent = useMemo(() => ensureContrast(accentHex), [accentHex]);
  const lyrics = useMemo(() => parseLRC(lrcText), [lrcText]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);

  // Throttle activeIndex updates: only recalc every ~100ms max, not every frame
  const lastCalcTimeRef = useRef(0);
  const lastActiveIndexRef = useRef(-1);

  useEffect(() => {
    const now = performance.now();
    if (now - lastCalcTimeRef.current < 80) return; // throttle to ~12 updates/sec
    lastCalcTimeRef.current = now;

    let newIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (currentTime >= lyrics[i].time - 0.2) {
            newIndex = i;
        } else {
            break;
        }
    }
    setActiveIndex(newIndex);
  }, [currentTime, lyrics]);

  // Only recalculate offset when activeIndex actually changes (NOT on every currentTime tick)
  useEffect(() => {
    if (activeIndex === lastActiveIndexRef.current) return;
    lastActiveIndexRef.current = activeIndex;

    if (scrollWrapperRef.current && containerRef.current) {
         if (activeIndex !== -1) {
             const activeEl = scrollWrapperRef.current.children[activeIndex + 1] as HTMLElement;
             if (activeEl) {
                 const containerCenter = containerRef.current.clientHeight / 2;
                 const elTop = activeEl.offsetTop;
                 const elHeight = activeEl.clientHeight;
                 setOffsetY(containerCenter - elTop - elHeight / 2);
             }
         } else {
             if (scrollWrapperRef.current.children.length > 1) {
                 const firstEl = scrollWrapperRef.current.children[1] as HTMLElement;
                 if (firstEl) {
                     const containerCenter = containerRef.current.clientHeight / 2;
                     const elTop = firstEl.offsetTop;
                     setOffsetY(containerCenter - elTop + 60);
                 }
             } else {
                 setOffsetY(0);
             }
         }
    }
  }, [activeIndex]); // removed currentTime from deps

  if (lyrics.length === 0) return null;

  if (isMobile) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-x-0 bottom-[80px] top-[56px] overflow-hidden pointer-events-none select-none z-40"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 80%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 80%, transparent)',
        }}
      >
        <div className="px-4 flex flex-col relative w-full h-full">
          <div
            ref={scrollWrapperRef}
            className="flex flex-col relative w-full"
            style={{
              transform: `translateY(${offsetY}px) translateZ(0)`,
              transition: 'transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              willChange: 'transform',
            }}
          >
            <div className="absolute left-[8px] top-0 bottom-0 w-[1px] bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]"></div>
            {lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              return (
                <div key={idx} className="relative pl-[32px] py-[10px] w-full transition-all duration-700 ease-out">
                  <div className="absolute left-[8px] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                    {isActive ? (
                      <div
                        className="w-3 h-3 rounded-full border-[2px] flex items-center justify-center bg-black/50 transition-all duration-500 ease-out"
                        style={{ borderColor: safeAccent, color: safeAccent, boxShadow: `0 0 15px ${safeAccent}88` }}
                      >
                        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: safeAccent }}></div>
                      </div>
                    ) : (
                      <div className="w-[3px] h-[3px] rounded-full transition-all duration-500 ease-out"
                        style={{
                          boxShadow: isPast ? `0 0 5px ${safeAccent}44` : 'none',
                          backgroundColor: isPast ? safeAccent : 'rgba(255,255,255,0.2)'
                        }}
                      />
                    )}
                  </div>
                  <div
                    className={`transition-all duration-700 ease-out whitespace-pre-wrap font-serif tracking-[0.05em] ${
                      isActive
                        ? 'text-white text-[20px] font-medium opacity-100'
                        : isPast
                          ? 'text-white/20 text-[14px] font-normal opacity-40 blur-[1px]'
                          : 'text-white/40 text-[14px] font-normal opacity-50'
                    }`}
                    style={{
                      transform: isActive ? 'translateY(0) scale(1.03) translateZ(0)' : 'translateY(0) scale(1) translateZ(0)',
                      transformOrigin: 'left center',
                      textShadow: isActive ? '0 0 15px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.5)' : 'none',
                    }}
                  >
                    {line.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
        ref={containerRef}
        className={`absolute left-[80px] top-[40vh] -translate-y-1/2 h-[60vh] w-[800px] overflow-hidden pointer-events-none select-none z-40 transition-all duration-1000 ease-out ${isPlaying ? 'opacity-100 translate-x-0 blur-none' : 'opacity-0 -translate-x-[20px] blur-sm'}`}
        data-lyrics-container="true"
        style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
            perspective: '1200px',
            perspectiveOrigin: 'left center'
        }}
    >
      <div
        className="px-[40px] flex flex-col relative w-full h-full"
        style={{
            transform: 'rotateY(20deg) rotateX(5deg) translateZ(-50px)',
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d'
        }}
      >
        <div
            ref={scrollWrapperRef}
            className="flex flex-col relative w-full"
            style={{
                transform: `translateY(${offsetY}px) translateZ(0)`,
                transition: 'transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                willChange: 'transform',
            }}
        >
            <div className="absolute left-[8px] top-0 bottom-0 w-[1px] bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]"></div>

            {lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              return (
                <div
                  key={idx}
                  className="relative pl-[40px] py-[14px] w-full transition-all duration-700 ease-out"
                >
                  <div className="absolute left-[8px] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                     {isActive ? (
                        <div
                          className="w-4 h-4 rounded-full border-[2px] flex items-center justify-center bg-black/50"
                          style={{ borderColor: safeAccent, color: safeAccent, boxShadow: `0 0 15px ${safeAccent}88` }}
                        >
                           <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: safeAccent }}></div>
                        </div>
                     ) : (
                        <div className="w-[3px] h-[3px] rounded-full bg-white/20" style={{ boxShadow: isPast ? `0 0 5px ${safeAccent}44` : 'none', backgroundColor: isPast ? safeAccent : 'rgba(255,255,255,0.2)' }}></div>
                     )}
                  </div>

                  <div
                    className={`transition-all duration-700 ease-out whitespace-pre-wrap font-serif tracking-[0.05em] ${
                        isActive
                            ? 'text-white text-[32px] font-medium opacity-100'
                            : isPast
                                ? 'text-white/20 text-[18px] font-normal opacity-40 blur-[1px]'
                                : 'text-white/40 text-[18px] font-normal opacity-50'
                    }`}
                    style={{
                        transform: isActive ? 'translateY(0) scale(1.05) translateZ(0)' : 'translateY(0) scale(1) translateZ(0)',
                        transformOrigin: 'left center',
                        textShadow: isActive ? '0 0 20px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)' : 'none',
                    }}
                  >
                    {line.text}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
