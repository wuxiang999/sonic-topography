import { useEffect } from 'react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  accentHex?: string;
}

const SHORTCUTS = [
  { key: 'Space', desc: '播放 / 暂停' },
  { key: '←', desc: '后退 5 秒' },
  { key: '→', desc: '快进 5 秒' },
  { key: '↑', desc: '增加音量' },
  { key: '↓', desc: '减小音量' },
  { key: 'F', desc: '全屏 / 退出全屏' },
  { key: 'M', desc: '静音 / 取消静音' },
  { key: 'H / ?', desc: '显示此帮助' },
];

export function KeyboardShortcutsHelp({ isOpen, onClose, accentHex = '#00ffff' }: KeyboardShortcutsHelpProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'h' || e.key === 'H' || e.key === '?') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-auto flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative border border-white/10 rounded-sm overflow-hidden w-[360px] max-w-[90vw] pointer-events-auto"
        style={{ background: 'rgba(5,10,15,0.95)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <line x1="6" y1="8" x2="10" y2="8" />
              <line x1="6" y1="12" x2="14" y2="12" />
              <line x1="6" y1="16" x2="8" y2="16" />
            </svg>
            <span className="text-[12px] uppercase tracking-[0.2em] text-white/70">
              键盘快捷键
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-[10px] uppercase tracking-[0.15em]"
          >
            ESC 关闭
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-5 py-4">
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0"
            >
              <span className="text-[12px] text-white/50">{shortcut.desc}</span>
              <kbd
                className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] rounded-sm border border-white/10"
                style={{
                  color: accentHex,
                  backgroundColor: `${accentHex}11`,
                  borderColor: `${accentHex}33`,
                }}
              >
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-white/5">
          <div className="text-[9px] text-white/20 uppercase tracking-[0.2em] text-center">
            按 <kbd className="text-white/40" style={{ color: accentHex }}>H</kbd> 或 <kbd className="text-white/40" style={{ color: accentHex }}>?</kbd> 随时打开
          </div>
        </div>
      </div>
    </div>
  );
}
