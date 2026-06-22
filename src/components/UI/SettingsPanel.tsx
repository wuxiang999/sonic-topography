import { X } from 'lucide-react';

export type LyricsStyleOption = '滚动' | '居中' | '高亮';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  barCount: number;
  onBarCountChange: (count: number) => void;
  lyricsVisible: boolean;
  onLyricsVisibleChange: (v: boolean) => void;
  lyricsStyle: LyricsStyleOption;
  onLyricsStyleChange: (style: LyricsStyleOption) => void;
  accentHex: string;
  maxHistoryItems: number;
  onMaxHistoryChange: (n: number) => void;
  showStats: boolean;
  onStatsVisibleChange: (v: boolean) => void;
}

const lyricsStyles: { value: LyricsStyleOption; label: string; desc: string }[] = [
  { value: '滚动', label: '滚动', desc: '3D 透视滚动' },
  { value: '居中', label: '居中', desc: '居中简洁' },
  { value: '高亮', label: '高亮', desc: '逐字高亮' },
];

export function SettingsPanel({
  isOpen,
  onClose,
  barCount,
  onBarCountChange,
  lyricsVisible,
  onLyricsVisibleChange,
  lyricsStyle,
  onLyricsStyleChange,
  accentHex,
  maxHistoryItems,
  onMaxHistoryChange,
  showStats,
  onStatsVisibleChange,
}: SettingsPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-auto flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative border border-white/10 rounded-sm overflow-hidden w-[420px] max-w-[90vw] max-h-[80vh] overflow-y-auto pointer-events-auto"
        style={{ background: 'rgba(5,10,15,0.96)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-[12px] uppercase tracking-[0.2em] text-white/70">
              设置
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {/* Section 1: 频谱显示 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="9" y2="15" />
                <line x1="15" y1="7" x2="15" y2="17" />
              </svg>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                频谱显示
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/60">条形数量</span>
              <span className="text-[11px] font-mono" style={{ color: accentHex }}>{barCount}</span>
            </div>
            <input
              type="range"
              min={16}
              max={128}
              step={8}
              value={barCount}
              onChange={(e) => onBarCountChange(parseInt(e.target.value))}
              className="w-full h-1 accent-current cursor-pointer bg-white/20 appearance-none rounded-full"
              style={{ accentColor: accentHex }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/20">16</span>
              <span className="text-[9px] text-white/20">128</span>
            </div>
          </div>

          {/* Section 2: 频段数值 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                <path d="M4 18h16M6 14h12M8 10h8M10 6h4" />
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
              </svg>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                频段数值
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/60">贝斯 · 中段 · 高音 · 能源</span>
              <button
                onClick={() => onStatsVisibleChange(!showStats)}
                className="text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm border transition-all duration-200"
                style={{
                  backgroundColor: showStats ? `${accentHex}20` : 'transparent',
                  borderColor: showStats ? accentHex : 'rgba(255,255,255,0.1)',
                  color: showStats ? accentHex : 'rgba(255,255,255,0.45)',
                }}
              >
                {showStats ? '显示' : '隐藏'}
              </button>
            </div>
          </div>

          {/* Section 3: 歌词设置 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                歌词设置
              </span>
            </div>

            {/* Toggle: 显示歌词 */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-white/60">显示歌词</span>
              <button
                onClick={() => onLyricsVisibleChange(!lyricsVisible)}
                className="text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm border transition-all duration-200"
                style={{
                  backgroundColor: lyricsVisible ? `${accentHex}20` : 'transparent',
                  borderColor: lyricsVisible ? accentHex : 'rgba(255,255,255,0.1)',
                  color: lyricsVisible ? accentHex : 'rgba(255,255,255,0.45)',
                }}
              >
                {lyricsVisible ? '开启' : '关闭'}
              </button>
            </div>

            {/* Style selector */}
            <div className="grid grid-cols-3 gap-2">
              {lyricsStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => onLyricsStyleChange(style.value)}
                  className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-sm border transition-all duration-200"
                  style={{
                    backgroundColor: lyricsStyle === style.value ? `${accentHex}20` : 'transparent',
                    borderColor: lyricsStyle === style.value ? accentHex : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <span
                    className="text-[11px] tracking-wider"
                    style={{
                      color: lyricsStyle === style.value ? accentHex : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {style.label}
                  </span>
                  <span className="text-[9px] text-white/30 leading-tight text-center">
                    {style.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: 播放记录 */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
              </svg>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                播放记录
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/60">保留条数</span>
              <span className="text-[11px] font-mono" style={{ color: accentHex }}>{maxHistoryItems}</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={maxHistoryItems}
              onChange={(e) => onMaxHistoryChange(parseInt(e.target.value))}
              className="w-full h-1 accent-current cursor-pointer bg-white/20 appearance-none rounded-full"
              style={{ accentColor: accentHex }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/20">10</span>
              <span className="text-[9px] text-white/20">100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
