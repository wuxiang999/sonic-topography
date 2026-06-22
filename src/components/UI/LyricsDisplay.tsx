import React, { useMemo, useEffect, useState, useRef } from 'react';
import { parseLRC } from '../../lib/lyrics';

// ── Adaptive accent color: ensure contrast against dark scene ─────
function ensureContrast(hex: string): string {
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
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.7) {
    const factor = 0.4 / Math.max(lum, 0.01);
    r = Math.min(255, Math.round(r * factor));
    g = Math.min(255, Math.round(g * factor));
    b = Math.min(255, Math.round(b * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
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

export type LyricsStyle = '滚动' | '居中' | '高亮';

interface LyricsDisplayProps {
  lrcText: string;
  currentTime: number;
  accentHex?: string;
  isPlaying?: boolean;
  isMobile?: boolean;
  isVisible?: boolean;
  lyricsStyle?: LyricsStyle;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lrcText, currentTime, accentHex = '#00ffff', isPlaying = true, 
  isMobile = false, isVisible = true, lyricsStyle = '滚动'
}) => {
  const safeAccent = useMemo(() => ensureContrast(accentHex), [accentHex]);
  const lyrics = useMemo(() => parseLRC(lrcText), [lrcText]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);

  const lastCalcTimeRef = useRef(0);
  const lastActiveIndexRef = useRef(-1);
  const lastStyleRef = useRef(lyricsStyle);

  // Reset scroll position when lyrics style changes
  useEffect(() => {
    if (lastStyleRef.current !== lyricsStyle) {
      lastStyleRef.current = lyricsStyle;
      setOffsetY(0);
      lastActiveIndexRef.current = -1;
    }
  }, [lyricsStyle]);

  useEffect(() => {
    const now = performance.now();
    if (now - lastCalcTimeRef.current < 80) return;
    lastCalcTimeRef.current = now;
    let newIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time - 0.2) {
        newIndex = i;
      } else break;
    }
    setActiveIndex(newIndex);
  }, [currentTime, lyrics]);

  useEffect(() => {
    if (activeIndex === lastActiveIndexRef.current) return;
    lastActiveIndexRef.current = activeIndex;
    if (scrollWrapperRef.current && containerRef.current) {
      // 居中 style has no spacer, so children index = activeIndex.
      // 滚动 and 高亮 styles have no spacer either - fix applied uniformly.
      const childIndex = activeIndex !== -1 ? activeIndex : 0;
      const targetEl = scrollWrapperRef.current.children[childIndex] as HTMLElement | undefined;
      if (targetEl) {
        const containerCenter = containerRef.current.clientHeight / 2;
        const elTop = targetEl.offsetTop;
        const elHeight = targetEl.clientHeight;
        if (activeIndex !== -1) {
          setOffsetY(containerCenter - elTop - elHeight / 2);
        } else {
          setOffsetY(containerCenter - elTop + 60);
        }
      } else {
        setOffsetY(0);
      }
    }
  }, [activeIndex]);

  if (lyrics.length === 0 || !isVisible) return null;

  // ── 居中 style: centered, simple, no timeline ──
  if (lyricsStyle === '居中') {
    return (
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none select-none z-40 transition-all duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        <div ref={containerRef} className="relative w-full max-w-[600px] h-[50vh] overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
          }}>
          <div ref={scrollWrapperRef} className="flex flex-col items-center w-full"
            style={{
              transform: `translateY(${offsetY}px)`,
              transition: 'transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}>
            {lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              return (
                <div key={idx} className="py-[14px] text-center w-full transition-all duration-700 ease-out">
                  <div className={`transition-all duration-700 whitespace-pre-wrap ${
                    isActive
                      ? 'text-white text-[26px] font-light opacity-100'
                      : isPast
                        ? 'text-white/20 text-[16px] opacity-30'
                        : 'text-white/40 text-[16px] opacity-50'
                  }`}
                    style={{
                      textShadow: isActive ? `0 0 30px ${safeAccent}44, 0 0 60px ${safeAccent}22` : 'none',
                    }}>
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

  // ── 高亮 style: karaoke-style character-by-character highlight ──
  if (lyricsStyle === '高亮') {
    const activeText = activeIndex >= 0 && activeIndex < lyrics.length ? lyrics[activeIndex].text : '';
    const progress = activeIndex >= 0
      ? (currentTime - lyrics[activeIndex].time) / ((lyrics[activeIndex + 1]?.time || lyrics[activeIndex].time + 5) - lyrics[activeIndex].time)
      : 0;
    const highlightPercent = Math.min(1, Math.max(0, progress));

    return (
      <div className={`absolute left-[80px] top-[40vh] -translate-y-1/2 h-[60vh] w-[800px] overflow-hidden pointer-events-none select-none z-40 transition-all duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
        }}>
        <div ref={containerRef} className="px-[40px] flex flex-col relative w-full h-full">
          <div ref={scrollWrapperRef} className="flex flex-col relative w-full"
            style={{
              transform: `translateY(${offsetY}px)`,
              transition: 'transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}>
            {lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              return (
                <div key={idx} className="relative pl-[40px] py-[14px] w-full transition-all duration-700 ease-out">
                  <div className={`whitespace-pre-wrap font-serif tracking-[0.05em] transition-all duration-700 ${
                    isActive
                      ? 'text-[32px] font-medium'
                      : isPast
                        ? 'text-white/20 text-[18px] opacity-40 blur-[1px]'
                        : 'text-white/40 text-[18px] opacity-50'
                  }`}>
                    {isActive ? (
                      <span>
                        <span style={{ color: safeAccent }}>{activeText.slice(0, Math.floor(activeText.length * highlightPercent))}</span>
                        <span className="text-white">{activeText.slice(Math.floor(activeText.length * highlightPercent))}</span>
                      </span>
                    ) : (
                      <span className="text-white">{line.text}</span>
                    )}
                  </div>
                  {isActive && (
                    <div className="absolute left-[40px] bottom-0 h-[2px] transition-all duration-200 ease-linear"
                      style={{
                        width: `${highlightPercent * 100}%`,
                        backgroundColor: safeAccent,
                        boxShadow: `0 0 10px ${safeAccent}`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── 滚动 style: original 3D scrolling lyrics (default) ──
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
        <div ref={scrollWrapperRef} className="flex flex-col relative w-full"
          style={{
            transform: `translateY(${offsetY}px) translateZ(0)`,
            transition: 'transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            willChange: 'transform',
          }}>
          {lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;
            return (
              <div key={idx} className="relative pl-[40px] py-[14px] w-full transition-all duration-700 ease-out">
                <div className="absolute left-[8px] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                  {isActive ? (
                    <div className="w-4 h-4 rounded-full border-[2px] flex items-center justify-center bg-black/50"
                      style={{ borderColor: safeAccent, color: safeAccent, boxShadow: `0 0 15px ${safeAccent}88` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: safeAccent }} />
                    </div>
                  ) : (
                    <div className="w-[3px] h-[3px] rounded-full" style={{
                      boxShadow: isPast ? `0 0 5px ${safeAccent}44` : 'none',
                      backgroundColor: isPast ? safeAccent : 'rgba(255,255,255,0.2)'
                    }} />
                  )}
                </div>
                <div className={`transition-all duration-700 ease-out whitespace-pre-wrap font-serif tracking-[0.05em] ${
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
                  }}>
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
