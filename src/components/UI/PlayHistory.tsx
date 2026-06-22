import { useState, useEffect, useCallback } from 'react';

interface HistoryItem {
  id: number;
  name: string;
  artist: string;
  album: string;
  picUrl?: string;
  playedAt: number; // timestamp
}

interface PlayHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSong: (id: number) => void;
  accentHex?: string;
}

const STORAGE_KEY = 'sonic-topography-history-v1';
const MAX_ITEMS = 50;

function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage may be full
  }
}

// Call this when a song starts playing
export function addToHistory(song: { id: number; name: string; artist: string; album: string; picUrl?: string }) {
  const history = readHistory();
  // Remove duplicate
  const filtered = history.filter((item) => item.id !== song.id);
  filtered.unshift({
    ...song,
    playedAt: Date.now(),
  });
  writeHistory(filtered);
}

export function PlayHistory({ isOpen, onClose, onLoadSong, accentHex = '#00ffff' }: PlayHistoryProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setItems(readHistory());
    }
  }, [isOpen]);

  const handleClear = useCallback(() => {
    writeHistory([]);
    setItems([]);
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-auto flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative border border-white/10 rounded-sm overflow-hidden w-[380px] max-w-[90vw] max-h-[70vh] pointer-events-auto flex flex-col"
        style={{ background: 'rgba(5,10,15,0.95)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            <span className="text-[12px] uppercase tracking-[0.2em] text-white/70">
              最近播放
            </span>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button
                onClick={handleClear}
                className="text-[9px] uppercase tracking-[0.15em] text-white/30 hover:text-red-400 transition-colors"
              >
                清空记录
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors text-[10px] uppercase tracking-[0.15em]"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/20 gap-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
              </svg>
              <div className="text-[11px] uppercase tracking-[0.2em]">暂无播放记录</div>
              <div className="text-[9px] text-white/10">播放歌曲后将在此显示</div>
            </div>
          ) : (
            <div className="py-1">
              {items.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  onClick={() => { onLoadSong(item.id); onClose(); }}
                >
                  {/* Cover thumbnail */}
                  <div className="w-8 h-8 rounded-[3px] overflow-hidden flex-shrink-0 bg-white/5">
                    {item.picUrl ? (
                      <img
                        src={item.picUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1">
                          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-white/70 truncate group-hover:text-white transition-colors">
                      {item.name}
                    </div>
                    <div className="text-[9px] text-white/30 truncate mt-0.5">
                      {item.artist || '未知'}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-[8px] text-white/20 uppercase tracking-wider flex-shrink-0">
                    {formatDate(item.playedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
