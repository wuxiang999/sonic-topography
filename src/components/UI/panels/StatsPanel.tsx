import { useState, useEffect } from 'react';
import { engine } from '../../../lib/AudioEngine';

export function StatsPanel({ accentHex }: { accentHex: string }) {
  const [data, setData] = useState({ bass: 0, mid: 0, treble: 0, energy: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      if (!engine.isPlaying && !engine.isCapturing) return;
      setData(engine.getAudioData());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-6 sm:gap-10">
      <StatBox label="Bass" value={data.bass} accentHex={accentHex} />
      <StatBox label="Mid" value={data.mid} accentHex={accentHex} />
      <StatBox label="Treble" value={data.treble} accentHex={accentHex} />
      <StatBox label="Energy" value={data.energy} accentHex={accentHex} />
    </div>
  );
}

function StatBox({ label, value, accentHex }: { label: string, value: number, accentHex: string }) {
  const displayValue = (value * 100).toFixed(1);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[9px] uppercase tracking-[0.15em] opacity-40">{label}</div>
      <div className="font-mono text-[14px]" style={{ color: accentHex }}>{displayValue}</div>
      <div className={`${isMobile ? 'w-[60px]' : 'w-[100px]'} h-[2px] relative bg-white/10`}>
        <div
          className="absolute h-full transition-all duration-75"
          style={{ backgroundColor: accentHex, width: `${Math.min(100, value * 100)}%`, boxShadow: `0 0 8px ${accentHex}88` }}
        />
      </div>
    </div>
  );
}
