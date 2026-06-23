import { X } from 'lucide-react';

export function MobileOverlay({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[65] pointer-events-auto backdrop-blur-[20px] flex flex-col" style={{ background: 'rgba(5,10,15,0.95)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="text-[12px] uppercase tracking-[0.2em] text-white/70">{title}</div>
        <button onClick={onClose} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
