import { useState } from 'react';
import { Play, Pause, Volume2, SkipForward, SkipBack, Palette, Repeat, Shuffle, ChevronUp } from 'lucide-react';
import { engine } from '../../../lib/AudioEngine';
import { themes } from '../../../lib/themes';
import type { NeteaseSong, PlayMode } from '../../../types';

export function MobilePlayerBar({
  trackName, isCapturing, theme, accentHex,
  currentTime, duration, isPlaying, togglePlay,
  playFromQueue, getCurrentQueue, formatTime,
  volume, setVolume, songToAdd, newPlaylistName, setNewPlaylistName,
  addSongToPlaylist, createPlaylistAndAddSong, onClose,
  playMode, setPlayMode, onThemeChange,
  seekingRef,
}: {
  trackName: string; isCapturing: boolean; theme: string;
  accentHex: string; currentTime: number; duration: number;
  isPlaying: boolean; togglePlay: () => void;
  playFromQueue: (d: 1 | -1) => void; getCurrentQueue: () => NeteaseSong[];
  formatTime: (t: number) => string;
  volume: number; setVolume: (v: number) => void;
  songToAdd: NeteaseSong | null; newPlaylistName: string; setNewPlaylistName: (v: string) => void;
  addSongToPlaylist: (id: string, song: NeteaseSong) => void;
  createPlaylistAndAddSong: () => void; onClose: () => void;
  playMode: PlayMode; setPlayMode: (m: PlayMode | ((p: PlayMode) => PlayMode)) => void;
  onThemeChange: (t: string) => void;
  seekingRef: React.MutableRefObject<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Collapsed Bottom Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto border-t border-white/10"
        style={{ background: 'rgba(2,4,10,0.92)' }}
      >
        {/* Thin progress bar at top */}
        <div className="w-full h-[2px] bg-white/10">
          <div
            className="h-full transition-all duration-200"
            style={{ backgroundColor: accentHex, width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        <div className="flex items-center h-[64px] px-3 gap-2">
          {/* Tap to expand */}
          <button onClick={() => setExpanded(true)} className="flex-1 flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-white truncate">{trackName}</div>
              <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">
                {theme === 'auto' ? '随歌自适应' : themes[theme]?.name} · {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button onClick={() => playFromQueue(-1)}
              className="text-white/60 hover:text-white transition-colors disabled:opacity-25"
              disabled={getCurrentQueue().length === 0}>
              <SkipBack size={18} />
            </button>
            <button onClick={togglePlay} className="text-white hover:text-white transition-colors w-[40px] h-[40px] rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${accentHex}22` }}>
              {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
            </button>
            <button onClick={() => playFromQueue(1)}
              className="text-white/60 hover:text-white transition-colors disabled:opacity-25"
              disabled={getCurrentQueue().length === 0}>
              <SkipForward size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Player Overlay */}
      {expanded && (
        <div className="fixed inset-0 z-[80] pointer-events-auto flex flex-col"
          style={{ background: 'rgba(2,4,10,0.96)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="text-[12px] uppercase tracking-[0.2em] text-white/70">正在播放</div>
            <button onClick={() => setExpanded(false)} className="text-white/40 hover:text-white">
              <ChevronUp size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col p-6 gap-6">
            {/* Track info */}
            <div>
              <div className="text-[22px] font-light tracking-[0.05em] text-white truncate">{trackName}</div>
              <div className="text-[11px] opacity-50 uppercase mt-2 tracking-wider">
                {isCapturing ? '系统音频录制' : '本地音频'}
                <span className="ml-2 text-[#3b82f6]">&bull; {theme === 'auto' ? '随歌自适应' : themes[theme]?.name}</span>
              </div>
            </div>

            {/* Progress bar with time labels */}
            <div className="flex flex-col gap-2">
              <div className="relative h-[6px] bg-white/10 rounded-full overflow-hidden">
                 <input
                   type="range" min={0} max={duration || 100} step="0.01"
                   value={currentTime}
                   onPointerDown={() => { seekingRef.current = true; }}
                   onPointerUp={() => { seekingRef.current = false; }}
                   onChange={(e) => {
                     if (engine.audioElement) {
                       engine.audioElement.currentTime = parseFloat(e.target.value);
                     }
                   }}
                   className="absolute inset-0 w-full opacity-0 cursor-pointer"
                 />
              </div>
              <div className="flex justify-between text-[10px] text-white/50 uppercase tracking-wider">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-8">
              <button onClick={() => {
                  const keys = ['auto', ...Object.keys(themes)];
                  const nextIndex = (keys.indexOf(theme) + 1) % keys.length;
                  onThemeChange(keys[nextIndex]);
                }}
                className="text-white/40 hover:text-white transition-colors"
                title="切换主题">
                <Palette size={20} />
              </button>
              <button onClick={() => playFromQueue(-1)}
                className="text-white/60 hover:text-white transition-colors disabled:opacity-25"
                disabled={getCurrentQueue().length === 0}>
                <SkipBack size={24} />
              </button>
              <button onClick={togglePlay}
                className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: accentHex }}>
                {isPlaying ? <Pause size={28} className="fill-current" /> : <Play size={28} className="fill-current ml-1" />}
              </button>
              <button onClick={() => playFromQueue(1)}
                className="text-white/60 hover:text-white transition-colors disabled:opacity-25"
                disabled={getCurrentQueue().length === 0}>
                <SkipForward size={24} />
              </button>
              <button onClick={() => setPlayMode((mode: PlayMode) => mode === 'sequence' ? 'shuffle' : mode === 'shuffle' ? 'repeat-one' : 'sequence')}
                className="hover:text-white transition-colors"
                style={{ color: playMode !== 'sequence' ? accentHex : undefined }}>
                {playMode === 'sequence' ? <Repeat size={20} /> : playMode === 'shuffle' ? <Shuffle size={20} /> : <span className="relative"><Repeat size={20} /><span className="absolute -top-1 -right-1 text-[8px] font-bold">1</span></span>}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 mt-auto">
              <Volume2 size={16} className="text-white/50" />
              <div className="flex-1 relative h-[4px] bg-white/10 rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full rounded-full"
                  style={{ backgroundColor: accentHex, width: `${volume * 100}%` }} />
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    engine.audioElement.volume = val;
                    setVolume(val);
                  }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Close */}
            <button onClick={onClose}
              className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white self-center mt-2">
              关闭曲目
            </button>
          </div>
        </div>
      )}
    </>
  );
}
