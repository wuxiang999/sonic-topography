import { useState } from 'react';

export function Section({ icon, title, desc, children, defaultOpen = true, accent }: {
  icon?: React.ReactNode; title: string; desc?: string; children: React.ReactNode; defaultOpen?: boolean; accent: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3 border border-white/[0.06] rounded-sm overflow-hidden group" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors relative"
      >
        <div
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-all duration-300"
          style={{ backgroundColor: open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0)' }}
        />
        <span className="text-white/50 flex-shrink-0 w-4 h-4">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/80">{title}</div>
          {desc && <div className="text-[9px] text-white/30 mt-0.5 leading-relaxed">{desc}</div>}
        </div>
        <span className={`text-white/20 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </span>
      </button>
      <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: open ? '2000px' : '0', opacity: open ? 1 : 0 }}>
        <div className="px-4 pb-4 pt-1">{children}</div>
      </div>
    </div>
  );
}
