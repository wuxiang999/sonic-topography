import { useState, useEffect } from 'react';
import type { NeteaseSong } from '../../../types';

export function QueuePanelContent({
  queue, currentSongId, loadNeteaseSong, removeFromQueue, onClose, accentHex
}: {
  queue: NeteaseSong[]; currentSongId: number | null;
  loadNeteaseSong: (song: NeteaseSong, queue?: NeteaseSong[]) => void;
  removeFromQueue: (id: number) => void; onClose: () => void; accentHex: string;
}) {
  const [items, setItems] = useState(queue);
  useEffect(() => { setItems(queue); }, [queue]);

  return (
    <>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] uppercase tracking-[0.2em] text-white/70">
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              播放队列
            </span>
          </div>
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white transition-colors">关闭</button>
        </div>
        <div className="text-[9px] text-white/20 uppercase tracking-[0.2em]">{queue.length} 首</div>
      </div>
      <div className="max-h-[48vh] overflow-y-auto scroll-smooth">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/20 gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <div className="text-[11px] uppercase tracking-[0.2em]">队列为空</div>
            <div className="text-[9px] text-white/10">搜索歌曲添加到队列</div>
          </div>
        ) : (
          <div className="py-1">
            {items.map((song: NeteaseSong, idx: number) => (
              <div key={song.id}
                className={"relative w-full flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.03] transition-all duration-200 group " + (currentSongId === song.id ? "bg-white/[0.04]" : "hover:bg-white/[0.03]")}
              >
                <span className="text-[10px] text-white/20 w-4 text-right flex-shrink-0 font-mono">{idx + 1}</span>
                <button onClick={() => loadNeteaseSong(song, queue)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className={"text-[12px] truncate " + (currentSongId === song.id ? "text-white" : "text-white/70 group-hover:text-white/90")}>
                    {currentSongId === song.id && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle animate-pulse" style={{ backgroundColor: accentHex }} />
                    )}
                    {song.name}
                  </div>
                  <div className="text-[9px] text-white/30 truncate">{song.artist || "未知"}</div>
                </button>
                <button onClick={() => removeFromQueue(song.id)}
                  className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="移出队列"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
