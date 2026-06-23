import { useRef, useState, useEffect } from 'react';
import type { NeteaseSong } from '../../../types';

const PLACEHOLDER_COVER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>');
const imgOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).src = PLACEHOLDER_COVER; };

export function SearchPanelContent({
  searchQuery, setSearchQuery, searchNetease, isSearching, searchStatus,
  searchResults, currentSongId, loadNeteaseSong, setSongToAdd, onClose, accentHex
}: {
  searchQuery: string; setSearchQuery: (v: string) => void;
  searchNetease: () => void; isSearching: boolean;
  searchStatus: string; searchResults: NeteaseSong[];
  currentSongId: number | null; loadNeteaseSong: (song: NeteaseSong, queue?: NeteaseSong[]) => void;
  setSongToAdd: (song: NeteaseSong | null) => void; onClose: () => void; accentHex: string;
}) {
  const [visibleCount, setVisibleCount] = useState(8);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(8); }, [searchResults]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 6, searchResults.length));
        }
      },
      { root: containerRef.current, rootMargin: "100px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [searchResults.length]);

  const hasMore = visibleCount < searchResults.length;

  return (
    <>
      <style>{`@keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[12px] uppercase tracking-[0.2em] text-white/70">
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              网易云搜索
            </span>
          </div>
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white transition-colors duration-300">关闭</button>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); searchNetease(); }}>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索歌曲或歌手..."
            className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded-sm px-3 py-2.5 text-[12px] text-white outline-none focus:border-white/30 transition-all duration-300 placeholder:text-white/20"
          />
          <button type="submit" disabled={isSearching}
            className="px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-black rounded-sm disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-200"
            style={{ backgroundColor: accentHex }}>
            {isSearching ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                搜索中
              </span>
            ) : "搜索"}
          </button>
        </form>
        {searchStatus && <div className="mt-3 text-[11px] text-white/45 animate-pulse">{searchStatus}</div>}
        {searchResults.length > 0 && (
          <div className="mt-3 text-[9px] uppercase tracking-[0.2em] text-white/20">
            找到 {searchResults.length} 首 · 显示 {Math.min(visibleCount, searchResults.length)}
          </div>
        )}
      </div>

      <div ref={containerRef} className="max-h-[48vh] overflow-y-auto scroll-smooth">
        <div className="py-1">
          {searchResults.slice(0, visibleCount).map((song, idx) => (
            <button key={song.id} onClick={() => loadNeteaseSong(song, searchResults)}
              className="relative w-full text-left px-5 py-3 pr-14 border-b border-white/[0.03] hover:bg-white/[0.04] active:bg-white/[0.06] transition-all duration-200 group"
              style={{ animation: "fadeSlideIn 0.35s ease-out both", animationDelay: ((idx % 8) * 0.04) + "s" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[3px] overflow-hidden flex-shrink-0 bg-white/5">
                  {song.picUrl ? (
                    <img src={song.picUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" onError={imgOnError} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={"flex items-center gap-2 text-[13px] truncate transition-colors duration-300 " + (currentSongId === song.id ? "text-white" : "text-white/80 group-hover:text-white")}>
                    {currentSongId === song.id && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: accentHex }} />
                    )}
                    <span className="truncate">{song.name}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/35 truncate group-hover:text-white/50 transition-colors duration-300">
                    {song.artist || "未知歌手"} · {song.album || ""}
                  </div>
                </div>
              </div>
              <span role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setSongToAdd(song); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSongToAdd(song); }}}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7 rounded-sm border border-white/5 text-white/30 hover:text-black hover:border-transparent hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                title="添加到歌单"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
            </button>
          ))}
        </div>

        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-5 gap-2 text-[10px] text-white/20 uppercase tracking-[0.15em]">
            <span className="w-4 h-[1px] bg-white/10" />
            <span className="flex items-center gap-1.5">
              加载更多
              <svg className="animate-bounce w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>
            </span>
            <span className="w-4 h-[1px] bg-white/10" />
          </div>
        )}

        {!hasMore && searchResults.length > 0 && (
          <div className="flex items-center justify-center py-4 text-[9px] text-white/15 uppercase tracking-[0.2em]">&mdash; 已显示全部 {searchResults.length} 首 &mdash;</div>
        )}
      </div>
    </>
  );
}
