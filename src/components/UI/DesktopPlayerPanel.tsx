import { useRef, useState } from 'react';
import { Play, Pause, Volume2, SkipForward, SkipBack, Palette, Shuffle, Repeat, ChevronDown, ChevronUp, Minimize2 } from 'lucide-react';
import { engine } from '../../lib/AudioEngine';
import { themes } from '../../lib/themes';

const PLACEHOLDER_COVER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>');
const imgOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).src = PLACEHOLDER_COVER; };

interface NeteaseSong {
  id: number;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
  picUrl?: string;
}

type PlayMode = 'sequence' | 'shuffle' | 'repeat-one';

export function DesktopPlayerPanel({
  trackName, artistName, isCapturing, theme, onThemeChange, accentHex,
  currentTime, duration, volume, setVolume,
  isPlaying, togglePlay, playFromQueue, getCurrentQueue,
  playMode, setPlayMode, formatTime, showThemeBtn,
  coverUrl
}: {
  trackName: string; artistName?: string; isCapturing: boolean; theme: string; onThemeChange: (t: string) => void;
  accentHex: string; currentTime: number; duration: number; volume: number; setVolume: (v: number) => void;
  isPlaying: boolean; togglePlay: () => void; playFromQueue: (d: 1 | -1) => void;
  getCurrentQueue: () => NeteaseSong[]; playMode: PlayMode; setPlayMode: (m: PlayMode | ((p: PlayMode) => PlayMode)) => void;
  formatTime: (t: number) => string; showThemeBtn?: boolean;
  coverUrl?: string;
}) {
  const seekingRef = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div
        className="fixed top-[40px] right-[40px] z-50 pointer-events-auto border border-white/10 rounded-sm overflow-hidden shadow-2xl backdrop-blur-[12px]"
        style={{ background: 'rgba(8,12,18,0.85)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={togglePlay} className="hover:text-white transition-colors text-white/60 flex-shrink-0">
            {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
          </button>
          <div className="min-w-0 max-w-[180px]">
            <div className="text-[11px] text-white/80 truncate">{trackName}</div>
            {artistName && <div className="text-[9px] text-white/40 truncate">{artistName}</div>}
          </div>
          <button onClick={() => setCollapsed(false)} className="text-white/30 hover:text-white transition-colors flex-shrink-0 ml-1" title="展开">
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute top-[40px] w-[400px] p-5 rounded-sm z-50 pointer-events-auto border border-white/10 overflow-hidden relative shadow-2xl backdrop-blur-[12px]"
      style={{ top: 40, right: 40, position: 'fixed', background: 'rgba(8,12,18,0.82)' }}
    >
      {/* Top accent glow line */}
      <div className="absolute top-0 left-4 right-4 h-[1px] z-20 pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${accentHex}66, transparent)` }} />
      {coverUrl && (
        <div className="absolute inset-0 -z-10">
          <img src={coverUrl} alt="" className="w-full h-full object-cover opacity-25" onError={imgOnError} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(5,10,15,0.5), rgba(5,10,15,0.92))' }} />
        </div>
      )}

      <div className="flex gap-5 mb-4">
        <div className="w-[120px] h-[120px] rounded-[4px] overflow-hidden flex-shrink-0 shadow-lg ring-1 ring-white/10">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="w-full h-full object-cover" onError={imgOnError} />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[16px] font-light tracking-[0.05em] text-white truncate" title={trackName}>
                  {trackName}
                </div>
                {artistName && (
                  <div className="text-[11px] text-white/40 truncate mt-0.5 tracking-wider" title={artistName}>
                    {artistName}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setCollapsed(true)} className="text-white/20 hover:text-white/60 transition-colors" title="收起">
                  <Minimize2 size={12} />
                </button>
                {showThemeBtn && (
                  <button
                    onClick={() => {
                      const keys = ['auto', ...Object.keys(themes)];
                      const nextIndex = (keys.indexOf(theme) + 1) % keys.length;
                      onThemeChange(keys[nextIndex]);
                    }}
                    className="text-white/40 hover:text-white transition-colors"
                    title="切换主题"
                  >
                    <Palette size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="text-[12px] opacity-50 uppercase mt-1.5 tracking-wider">
              {isCapturing ? '系统音频录制' : '本地音频'}
              <span className="ml-2 text-[10px]" style={{ color: accentHex }}>&bull; {theme === 'auto' ? '随歌自适应' : themes[theme]?.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`h-[20px] mb-4 relative flex items-end group ${isCapturing ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="w-full relative h-[2px] bg-white/10 group-hover:h-[4px] transition-all duration-200">
          <div
            className="absolute top-0 left-0 h-full transition-all duration-100"
            style={{
              backgroundColor: accentHex,
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              boxShadow: `0 0 10px ${accentHex}88`
            }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step="0.01"
          value={currentTime}
          onPointerDown={() => { seekingRef.current = true; }}
          onPointerUp={() => { seekingRef.current = false; }}
          onChange={(e) => {
            if (engine.audioElement) {
              const newTime = parseFloat(e.target.value);
              engine.audioElement.currentTime = newTime;
            }
          }}
          className="absolute bottom-0 left-0 w-full opacity-0 cursor-pointer h-full"
        />
      </div>

      <div className={`flex items-center justify-between ${isCapturing ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => playFromQueue(-1)}
            className="hover:text-white transition-colors disabled:opacity-25 disabled:hover:text-inherit"
            disabled={getCurrentQueue().length === 0}
            title="上一首"
          >
            <SkipBack size={16} />
          </button>
          <button onClick={togglePlay} className="hover:text-white transition-colors">
            {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current" />}
          </button>
          <button
            onClick={() => playFromQueue(1)}
            className="hover:text-white transition-colors disabled:opacity-25 disabled:hover:text-inherit"
            disabled={getCurrentQueue().length === 0}
            title="下一首"
          >
            <SkipForward size={16} />
          </button>
          <button
            onClick={() => setPlayMode((mode: PlayMode) => mode === 'sequence' ? 'shuffle' : mode === 'shuffle' ? 'repeat-one' : 'sequence')}
            className="hover:text-white transition-colors"
            title={playMode === 'sequence' ? '顺序播放' : playMode === 'shuffle' ? '随机播放' : '单曲循环'}
            style={{ color: playMode !== 'sequence' ? accentHex : undefined }}
          >
            {playMode === 'sequence' ? <Repeat size={14} /> : playMode === 'shuffle' ? <Shuffle size={14} /> : <span className="relative inline-flex"><Repeat size={14} /><span className="absolute -top-1.5 -right-1.5 text-[7px] font-bold leading-none">1</span></span>}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.1em] opacity-80 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1 opacity-40">/</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                engine.audioElement.volume = val;
                setVolume(val);
              }}
              className="w-20 h-1 accent-current cursor-pointer bg-white/20 appearance-none rounded-full"
              style={{ accentColor: accentHex }}
            />
            <Volume2
              size={14}
              className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
              onClick={() => {
                const val = volume > 0 ? 0 : 1;
                engine.audioElement.volume = val;
                setVolume(val);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
