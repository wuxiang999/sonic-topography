import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, SkipForward, SkipBack, Palette, Plus, ListMusic, Shuffle, Repeat, Trash2, Menu, X, ChevronUp, Music, Upload, Radio, Search } from 'lucide-react';
import { engine } from '../../lib/AudioEngine';
import { themes } from '../../lib/themes';
import { LyricsDisplay } from './LyricsDisplay';
import { DesktopPlayerPanel } from './DesktopPlayerPanel';
import { VisualizerOverlay } from './VisualizerOverlay';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { PlayHistory, addToHistory } from './PlayHistory';
import { SettingsPanel, type LyricsStyleOption } from './SettingsPanel';
import { FirstTimeTutorial } from './FirstTimeTutorial';
import { extractAudioMetadata, extractLyricsFromAudio } from '../../lib/metadata';

// Placeholder for broken Netease cover images
const PLACEHOLDER_COVER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>');
const imgOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).src = PLACEHOLDER_COVER; };

// ── Types ──
interface NeteaseSong {
  id: number;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
  picUrl?: string;
}
interface SavedPlaylist {
  id: string;
  name: string;
  songs: NeteaseSong[];
}
type PlayMode = 'sequence' | 'shuffle' | 'repeat-one';
type PendingDelete =
  | { type: 'song'; playlistId: string; songId: number; label: string }
  | { type: 'playlist'; playlistId: string; label: string };

// ── Playlist storage ──
const PLAYLIST_STORAGE_KEY = 'sonic-topography-playlists-v1';

function createDefaultPlaylists(): SavedPlaylist[] {
  return [
    { id: 'favorites', name: "收藏", songs: [] },
    { id: 'visual-set', name: "视觉集", songs: [] },
  ];
}

function readSavedPlaylists(): SavedPlaylist[] {
  try {
    const raw = window.localStorage.getItem(PLAYLIST_STORAGE_KEY);
    if (!raw) return createDefaultPlaylists();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return createDefaultPlaylists();
    return parsed.map((playlist: SavedPlaylist) => ({
      id: playlist.id,
      name: playlist.name,
      songs: Array.isArray(playlist.songs) ? playlist.songs : [],
    }));
  } catch (error) {
    console.warn('Unable to read saved playlists:', error);
    return createDefaultPlaylists();
  }
}

function hasSavedSongs(playlists: SavedPlaylist[]): boolean {
  return playlists.some((playlist) => playlist.songs.length > 0);
}

// ── UI Props & Component ──
interface UIProps {
  theme: string;
  onThemeChange: (t: string) => void;
  isMobile?: boolean;
  onCoverChange?: (url: string) => void;
  uiHidden?: boolean;
  onUiHiddenChange?: (v: boolean) => void;
  userQuality?: 'low' | 'medium' | 'high' | null;
  onQualityChange?: (v: 'low' | 'medium' | 'high' | null) => void;
  userAntialias?: boolean | null;
  onAntialiasChange?: (v: boolean | null) => void;
}

export function UI({ theme, onThemeChange, isMobile = false, onCoverChange, uiHidden = false, onUiHiddenChange, userQuality, onQualityChange, userAntialias, onAntialiasChange }: UIProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoAudioUrl = '/music/demo.mp3';
  const demoLyricsUrl = '/music/demo.lrc';
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarLeaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleSidebarEnter = () => {
    if (sidebarLeaveTimer.current) clearTimeout(sidebarLeaveTimer.current);
    setSidebarHovered(true);
  };
  const handleSidebarLeave = () => {
    sidebarLeaveTimer.current = setTimeout(() => setSidebarHovered(false), 350);
  };
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackName, setTrackName] = useState<string>('未选择曲目');
  const [watermarkVisible, setWatermarkVisible] = useState(true);
  const [artistName, setArtistName] = useState<string>('');
  const [lyricsText, setLyricsText] = useState<string>('');
  const [lyricsVisible, setLyricsVisible] = useState(true);
  const [lyricsStyle, setLyricsStyle] = useState<'滚动' | '居中' | '高亮'>('滚动');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const seekingRef = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFreqPanel, setShowFreqPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NeteaseSong[]>([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showPlaylistPanel, setShowPlaylistPanel] = useState(false);
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(readSavedPlaylists);
  const [activePlaylistId, setActivePlaylistId] = useState('favorites');
  const [songToAdd, setSongToAdd] = useState<NeteaseSong | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>('sequence');
  const [playQueue, setPlayQueue] = useState<NeteaseSong[]>([]);
  const [currentSongId, setCurrentSongId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const hasLoadedPlaylistsRef = useRef(false);

  // Mobile-specific state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Shortcuts help & Play History
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showPlayHistory, setShowPlayHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [barCount, setBarCount] = useState(64);
  const [maxHistoryItems, setMaxHistoryItems] = useState(50);
  const [showStats, setShowStats] = useState(true);

  useEffect(() => {
    if (!hasLoadedPlaylistsRef.current) return;
    window.localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
    fetch('/music/api/playlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists }),
    }).catch((error) => {
      console.warn('Unable to save playlists to local server:', error);
    });
  }, [playlists]);

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const response = await fetch('/music/api/playlists');
        if (!response.ok) throw new Error('Playlist request failed');
        const data = await response.json();
        if (Array.isArray(data.playlists) && data.playlists.length > 0) {
          const serverPlaylists = data.playlists;
          const browserPlaylists = readSavedPlaylists();
          if (!hasSavedSongs(serverPlaylists) && hasSavedSongs(browserPlaylists)) {
            setPlaylists(browserPlaylists);
          } else {
            setPlaylists(serverPlaylists);
          }
        }
      } catch (error) {
        console.warn('Using browser playlist storage:', error);
      } finally {
        hasLoadedPlaylistsRef.current = true;
      }
    };

    loadPlaylists();
  }, []);

  // Audio state poller
  useEffect(() => {
    const initEngine = async () => {
       await engine.init();
    };
    initEngine();

    let animationFrameId: number;
    const poll = () => {
      setIsPlaying(engine.isPlaying);
      if (!seekingRef.current) setCurrentTime(engine.audioElement.currentTime);
      setDuration(engine.audioElement.duration || 0);
      setVolume(engine.audioElement.volume);
      setIsCapturing(engine.isCapturing);
      animationFrameId = requestAnimationFrame(poll);
    };
    poll();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    let audioFile: File | null = null;
    let lrcFile: File | null = null;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.flac')) {
            audioFile = file;
        } else if (file.name.endsWith('.lrc')) {
            lrcFile = file;
        }
    }

    if (lrcFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setLyricsText(text);
        };
        reader.readAsText(lrcFile);
    } else if (audioFile) {
        setLyricsText('');
        const extractedLyrics = await extractLyricsFromAudio(audioFile);
        if (extractedLyrics) {
             setLyricsText(extractedLyrics);
        }
    } else {
        setLyricsText('');
    }

    if (audioFile) {
        setTrackName(audioFile.name);
        engine.init();
        engine.loadFile(audioFile);
        engine.play();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const loadDemo = async () => {
    const audioName = demoAudioUrl.split('/').pop() || 'demo.mp3';

    setTrackName('正在加载示例...');
    setLyricsText('');

    try {
      const audioResponse = await fetch(demoAudioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Demo audio not found: ${demoAudioUrl}`);
      }

      const audioBlob = await audioResponse.blob();
      const metadata = await extractAudioMetadata(audioBlob, audioName);
      setTrackName(metadata.displayName);

      let demoLyrics = metadata.lyrics || '';
      try {
        const lyricsResponse = await fetch(demoLyricsUrl, { cache: 'no-store' });
        if (lyricsResponse.ok) {
          demoLyrics = await lyricsResponse.text();
        }
      } catch (error) {
        console.warn('Demo lyrics file is not available:', error);
      }

      setLyricsText(demoLyrics);
      engine.init();
      engine.loadUrl(demoAudioUrl);
      engine.play();
    } catch (error) {
      console.warn('Unable to load demo track:', error);
      setTrackName('未选择曲目');
      setArtistName('');
      setLyricsText('');
    }
  };

  const togglePlay = () => {
    engine.init();
    engine.togglePlay();
  };

  const searchNetease = async () => {
    const keywords = searchQuery.trim();
    if (!keywords) return;

    setIsSearching(true);
    setSearchStatus('搜索中...');
    setSearchResults([]);

    try {
      const response = await fetch(`/music/api/netease/search?keywords=${encodeURIComponent(keywords)}&limit=12`);
      if (!response.ok) throw new Error('Search request failed');

      const data = await response.json();
      setSearchResults(data.songs || []);
      setSearchStatus(data.songs?.length ? '' : '未找到可播放的歌曲');
    } catch (error) {
      console.warn('Netease search failed:', error);
      setSearchStatus('搜索失败');
    } finally {
      setIsSearching(false);
    }
  };

  const loadNeteaseSong = async (song: NeteaseSong, queue?: NeteaseSong[]) => {
    if (queue) setPlayQueue(queue);
    setCurrentSongId(song.id);
    setCurrentCover(song.picUrl || '');
    if (onCoverChange) onCoverChange(song.picUrl || '');
    setTrackName(song.name);
    setArtistName(song.artist || '');
    setLyricsText('');
    setSearchStatus('正在加载歌曲...');

    try {
      const [urlResponse, lyricResponse] = await Promise.all([
        fetch(`/music/api/netease/url?id=${song.id}`),
        fetch(`/music/api/netease/lyric?id=${song.id}`),
      ]);

      const urlData = await urlResponse.json();
      const lyricData = await lyricResponse.json();
      const lyric = lyricData.lyric || lyricData.translatedLyric || '';
      setLyricsText(lyric);

      if (!urlData.url) {
        setSearchStatus('歌曲不可用，跳过...');
        playFromQueue(1, song.id);
        return;
      }

      engine.init();
      // Use crossfade for smooth transition
      engine.crossfadeTo(`/music/api/netease/audio?id=${song.id}`);
      setSearchStatus('');
      setShowSearchPanel(false);
      addToHistory({ id: song.id, name: song.name, artist: song.artist, album: song.album, picUrl: song.picUrl });
    } catch (error) {
      console.warn('Unable to load Netease song:', error);
      setSearchStatus('加载失败，跳过...');
      playFromQueue(1, song.id);
    }
  };

  const getCurrentQueue = () => playQueue.length > 0 ? playQueue : activePlaylist?.songs || [];

  const playFromQueue = (direction: 1 | -1, fromSongId = currentSongId) => {
    const queue = getCurrentQueue();
    if (queue.length === 0) return;

    let nextIndex = 0;
    const currentIndex = queue.findIndex((song) => song.id === fromSongId);

    if (playMode === 'shuffle' && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex);
    } else if (playMode === 'repeat-one') {
      nextIndex = currentIndex >= 0 ? currentIndex : 0;
    } else {
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      nextIndex = (baseIndex + direction + queue.length) % queue.length;
    }

    loadNeteaseSong(queue[nextIndex], queue);
  };

  useEffect(() => {
    const handleEnded = () => {
      const queue = getCurrentQueue();
      if (playMode === 'repeat-one' && currentSongId) {
        loadNeteaseSong(queue.find(s => s.id === currentSongId) || queue[0], queue);
      } else if (queue.length > 1) {
        playFromQueue(1);
      }
    };

    engine.audioElement.addEventListener('ended', handleEnded);
    return () => engine.audioElement.removeEventListener('ended', handleEnded);
  }, [playQueue, currentSongId, playMode, activePlaylistId, playlists]);

  // ── Session persist ─────────────────────────────────────────
  useEffect(() => {
    try {
      sessionStorage.setItem('sonic-player-state', JSON.stringify({
        volume,
        playMode,
        currentSongId,
      }));
    } catch {}
  }, [volume, playMode, currentSongId]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('sonic-player-state');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.volume !== undefined) {
          setVolume(data.volume);
          if (engine.audioElement) engine.audioElement.volume = data.volume;
        }
        if (data.playMode) setPlayMode(data.playMode);
        if (data.currentSongId) setCurrentSongId(data.currentSongId);
      }
    } catch {}
  }, []);

  const addSongToPlaylist = (playlistId: string, song: NeteaseSong) => {
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      const exists = playlist.songs.some((savedSong) => savedSong.id === song.id);
      if (exists) return playlist;
      return { ...playlist, songs: [...playlist.songs, song] };
    }));
    const playlistName = playlists.find((playlist) => playlist.id === playlistId)?.name || 'playlist';
    setSearchStatus(`已添加到 ${playlistName}`);
    setSongToAdd(null);
  };

  const createPlaylistAndAddSong = () => {
    const name = newPlaylistName.trim();
    if (!name || !songToAdd) return;

    const id = `playlist-${Date.now()}`;
    setPlaylists((current) => [...current, { id, name, songs: [songToAdd] }]);
    setActivePlaylistId(id);
    setSearchStatus(`已添加到 ${name}`);
    setSongToAdd(null);
    setNewPlaylistName('');
  };

  const deleteSongFromPlaylist = (playlistId: string, songId: number) => {
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      return { ...playlist, songs: playlist.songs.filter((song) => song.id !== songId) };
    }));

    setPlayQueue((queue) => queue.filter((song) => song.id !== songId));
    if (currentSongId === songId) {
      setCurrentSongId(null);
    }
  };

  const deletePlaylist = (playlistId: string) => {
    if (playlists.length <= 1) return;

    const nextPlaylists = playlists.filter((playlist) => playlist.id !== playlistId);
    setPlaylists(nextPlaylists);

    if (activePlaylistId === playlistId) {
      setActivePlaylistId(nextPlaylists[0]?.id || 'favorites');
    }

    const deletedPlaylist = playlists.find((playlist) => playlist.id === playlistId);
    if (deletedPlaylist?.songs.some((song) => song.id === currentSongId)) {
      setPlayQueue([]);
      setCurrentSongId(null);
    }
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === 'song') {
      deleteSongFromPlaylist(pendingDelete.playlistId, pendingDelete.songId);
    } else {
      deletePlaylist(pendingDelete.playlistId);
    }

    setPendingDelete(null);
  };

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) || playlists[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        engine.init();
        engine.togglePlay();
      }
      if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        e.preventDefault();
        setShowShortcutsHelp((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatTime = (time: number) => {
     if(isNaN(time)) return "0:00";
     const min = Math.floor(time / 60);
     const sec = Math.floor(time % 60);
     return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Drag and drop global listeners
  useEffect(() => {
    const handleDragOverGlobal = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeaveGlobal = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 || e.clientY === 0) {
        setIsDragging(false);
      }
    };
    const handleDropGlobal = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer?.files || null);
    };

    window.addEventListener('dragover', handleDragOverGlobal);
    window.addEventListener('dragleave', handleDragLeaveGlobal);
    window.addEventListener('drop', handleDropGlobal);

    return () => {
      window.removeEventListener('dragover', handleDragOverGlobal);
      window.removeEventListener('dragleave', handleDragLeaveGlobal);
      window.removeEventListener('drop', handleDropGlobal);
    };
  }, []);

  const t = themes[theme] || themes['nocturnal'];
  const accentHex = `#${t.uRippleColor.getHexString()}`;

  // Audio-reactive - updates indicator DOM directly with scene accent colors
  useEffect(() => {
    let rafId: number;
    const el = indicatorRef.current;
    // Parse hex to HSL so we can use the scene's exact hue
    let baseH = 200, baseS = 70;
    try {
      const hex = accentHex.replace('#', '');
      const r = parseInt(hex.substring(0,2), 16) / 255;
      const g = parseInt(hex.substring(2,4), 16) / 255;
      const b = parseInt(hex.substring(4,6), 16) / 255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        baseS = l > 0.5 ? (d / (2 - max - min)) * 100 : (d / (max + min)) * 100;
        switch (max) {
          case r: baseH = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
          case g: baseH = ((b - r) / d + 2) * 60; break;
          case b: baseH = ((r - g) / d + 4) * 60; break;
        }
      }
    } catch {}
    const update = () => {
      const data = engine.getAudioData();
      const energy = data.energy || 0;
      const bass = data.bass || 0;
      if (el) {
        const bright = 30 + energy * 50;
        const sat = baseS * (0.6 + bass * 0.4);
        if (energy > 0.02) {
          const hueShift = (bass - 0.5) * 20; // slight hue shift with bass
          el.style.background = 'linear-gradient(180deg, transparent, hsl(' + (baseH + hueShift) + ',' + sat + '%,' + bright + '%) 25%, hsl(' + (baseH + hueShift + 30) + ',' + sat + '%,' + (bright + 8) + '%) 75%, transparent)';
          el.style.boxShadow = '0 0 12px hsla(' + baseH + ',' + sat + '%,60%,' + (0.08 + energy * 0.35) + ')';
        } else {
          el.style.background = 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 75%, transparent)';
          el.style.boxShadow = 'none';
        }
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [accentHex]);
  const [currentCover, setCurrentCover] = useState('');
  const hasTrack = trackName !== '未选择曲目';

  // ── No-UI mode: render nothing ────────────────
  if (uiHidden) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 flex w-full h-full"
      style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: '#94a3b8' }}
    >
      {isDragging && (
        <div
          className="absolute inset-0 z-[60] backdrop-blur-sm border-2 border-dashed m-4 rounded-xl flex items-center justify-center font-mono text-2xl tracking-widest pointer-events-none"
          style={{ backgroundColor: `${accentHex}1a`, borderColor: accentHex, color: accentHex }}
        >
          拖放音频文件播放
        </div>
      )}

      {/* ==================== DESKTOP LAYOUT ==================== */}
      {!isMobile && (
        <>
          {/* Sidebar Left - hover to show categorized buttons */}
          <div className="absolute left-0 top-0 h-full z-[60]">
            {/* Trigger strip */}
            <div className="absolute left-0 top-0 h-full w-[7px] z-[62] cursor-pointer pointer-events-auto" onMouseEnter={handleSidebarEnter} />
            {/* Sidebar bar */}
            <div className="h-full flex flex-col pointer-events-auto overflow-hidden border-r border-white/5 transition-all duration-300 ease-in-out"
              style={{ width: sidebarHovered ? 44 : 0, background: 'rgba(2,4,10,0.85)', borderRightWidth: sidebarHovered ? 1 : 0 }}
              onMouseEnter={handleSidebarEnter}
              onMouseLeave={handleSidebarLeave}
            >
              <div className="flex flex-col items-center py-3 gap-5 min-w-[44px] h-full">
                {/* === 功能 === */}
                <button onClick={() => setShowSearchPanel(true)} className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer whitespace-nowrap" style={{ writingMode: 'vertical-rl' }} title="搜索">搜索</button>
                <button onClick={() => setShowPlaylistPanel(true)} className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer whitespace-nowrap" style={{ writingMode: 'vertical-rl' }} title="播放列表">播放列表</button>
                <button onClick={() => setShowPlayHistory(true)} className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer whitespace-nowrap" style={{ writingMode: 'vertical-rl' }} title="播放历史">播放历史</button>
                <button onClick={() => setShowFreqPanel(true)} className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer whitespace-nowrap" style={{ writingMode: 'vertical-rl' }} title="频率触发">频率触发</button>

                <div className="border-t border-white/5 w-6" />

                {/* === 工具 === */}
                <button onClick={loadDemo} className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer font-bold whitespace-nowrap" style={{ writingMode: 'vertical-rl' }} title="示例">示例</button>
                <button onClick={() => fileInputRef.current?.click()} className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer whitespace-nowrap" style={{ writingMode: 'vertical-rl' }} title="上传">上传</button>
                <button
                  onClick={() => {
                    if (engine.isCapturing) {
                      engine.stopCapture();
                      setTrackName('未选择曲目');
                      setArtistName('');
                    } else {
                      engine.startCapture().then(() => {
                        if (engine.isCapturing) setTrackName('系统音频录制');
                      });
                    }
                  }}
                  className={`uppercase tracking-[0.2em] text-[10px] transition-opacity cursor-pointer whitespace-nowrap ${isCapturing ? 'opacity-100 text-[#ef4444]' : 'opacity-40 hover:opacity-100'}`}
                  style={{ writingMode: 'vertical-rl' }}
                  title={isCapturing ? '停止捕获系统音频' : '捕获系统音频'}
                >
                  {isCapturing ? '停止捕获' : '系统音频'}
                </button>

                <div className="flex-1" />

                {/* === 设置 === */}
                <div className="border-t border-white/5 w-6" />
                <button
                  onClick={() => setShowSettings(true)}
                  className="uppercase tracking-[0.2em] text-[10px] opacity-50 hover:opacity-100 transition-all cursor-pointer whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', color: showSettings ? accentHex : 'rgba(255,255,255,0.5)' }}
                  title="设置"
                >
                  设置
                </button>
              </div>
              <input type="file" ref={fileInputRef} accept="audio/*,.lrc" multiple className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* Desktop Search Panel */}
          {showSearchPanel && (
            <div className="absolute top-[40px] left-[100px] w-[360px] max-h-[70vh] z-50 pointer-events-auto backdrop-blur-[20px] border border-white/10 rounded-sm overflow-hidden" style={{ background: 'rgba(5,10,15,0.88)' }}>
              <SearchPanelContent
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchNetease={searchNetease}
                isSearching={isSearching}
                searchStatus={searchStatus}
                searchResults={searchResults}
                currentSongId={currentSongId}
                loadNeteaseSong={loadNeteaseSong}
                setSongToAdd={setSongToAdd}
                onClose={() => setShowSearchPanel(false)}
                accentHex={accentHex}
              />
            </div>
          )}

          {/* Desktop Playlist Panel */}
          {showPlaylistPanel && (
            <div className="absolute top-[40px] left-[100px] w-[420px] max-h-[74vh] z-[65] pointer-events-auto backdrop-blur-[20px] border border-white/10 rounded-sm overflow-hidden" style={{ background: 'rgba(5,10,15,0.9)' }}>
              <PlaylistPanelContent
                playlists={playlists}
                activePlaylist={activePlaylist}
                activePlaylistId={activePlaylistId}
                setActivePlaylistId={setActivePlaylistId}
                currentSongId={currentSongId}
                loadNeteaseSong={loadNeteaseSong}
                setPendingDelete={setPendingDelete}
                playlistsLength={playlists.length}
                onClose={() => setShowPlaylistPanel(false)}
                accentHex={accentHex}
              />
            </div>
          )}

          {/* Desktop Song-to-Add Dialog */}
          {songToAdd && (
            <div className="absolute top-[120px] left-[480px] w-[280px] z-[70] pointer-events-auto backdrop-blur-[20px] border border-white/10 rounded-sm overflow-hidden" style={{ background: 'rgba(5,10,15,0.94)' }}>
              <SongToAddPanel
                songToAdd={songToAdd!}
                playlists={playlists}
                newPlaylistName={newPlaylistName}
                setNewPlaylistName={setNewPlaylistName}
                addSongToPlaylist={addSongToPlaylist}
                createPlaylistAndAddSong={createPlaylistAndAddSong}
                onClose={() => setSongToAdd(null)}
                accentHex={accentHex}
              />
            </div>
          )}

          {/* Desktop Player Panel */}
          {hasTrack && (
            <DesktopPlayerPanel
              trackName={trackName}
              artistName={artistName}
              isCapturing={isCapturing}
              theme={theme}
              onThemeChange={onThemeChange}
              accentHex={accentHex}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              setVolume={setVolume}
              isPlaying={isPlaying}
              togglePlay={togglePlay}
              playFromQueue={playFromQueue}
              getCurrentQueue={getCurrentQueue}
              playMode={playMode}
              setPlayMode={setPlayMode}
              formatTime={formatTime}
              showThemeBtn
              coverUrl={currentCover}
            />
          )}

          {/* Desktop Stats Panel & Lyrics Status */}
          {hasTrack && (
            <div className="absolute bottom-[40px] left-[100px] z-50 pointer-events-none flex flex-col gap-6">
              {!lyricsText && (
                 <div
                    className="text-[10px] text-white/40 uppercase tracking-[0.2em] flex items-center gap-2 pointer-events-auto cursor-pointer hover:text-white/80 transition-colors w-fit"
                    onClick={() => fileInputRef.current?.click()}
                    title="上传 .lrc 文件"
                 >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/50"></div>
                    暂无歌词 • 点击上传 .lrc 文件
                 </div>
              )}
              {showStats && <StatsPanel accentHex={accentHex} />}
            </div>
          )}

        </>
      )}

      {/* ==================== MOBILE LAYOUT ==================== */}
      {isMobile && (
        <>
          {/* Mobile Brand Mark */}
          {watermarkVisible ? (
            <div className="absolute top-[12px] left-[16px] z-50 pointer-events-auto select-none cursor-pointer" onClick={() => setWatermarkVisible(false)}>
              <div className="font-black text-[18px] tracking-[-1px] text-white leading-none">AJIN.</div>
              <div className="text-[7px] tracking-[0.2em] text-white/25">LANHU199-PLUS</div>
            </div>
          ) : (
            <div className="absolute top-[12px] left-[16px] z-50 pointer-events-auto">
              <button onClick={() => setWatermarkVisible(true)} className="text-[9px] text-white/20 hover:text-white/60 tracking-[0.15em]">⊕</button>
            </div>
          )}

          {/* Mobile Search Overlay */}
          {showSearchPanel && (
            <MobileOverlay onClose={() => setShowSearchPanel(false)} title="搜索">
              <SearchPanelContent
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchNetease={searchNetease}
                isSearching={isSearching}
                searchStatus={searchStatus}
                searchResults={searchResults}
                currentSongId={currentSongId}
                loadNeteaseSong={loadNeteaseSong}
                setSongToAdd={setSongToAdd}
                onClose={() => setShowSearchPanel(false)}
                accentHex={accentHex}
              />
            </MobileOverlay>
          )}

          {/* Mobile Playlist Overlay */}
          {showPlaylistPanel && (
            <MobileOverlay onClose={() => setShowPlaylistPanel(false)} title="播放列表">
              <PlaylistPanelContent
                playlists={playlists}
                activePlaylist={activePlaylist}
                activePlaylistId={activePlaylistId}
                setActivePlaylistId={setActivePlaylistId}
                currentSongId={currentSongId}
                loadNeteaseSong={loadNeteaseSong}
                setPendingDelete={setPendingDelete}
                playlistsLength={playlists.length}
                onClose={() => setShowPlaylistPanel(false)}
                accentHex={accentHex}
              />
            </MobileOverlay>
          )}

          {/* Mobile Song-to-Add Overlay */}
          {songToAdd && (
            <MobileOverlay onClose={() => setSongToAdd(null)} title="添加到歌单">
              <div className="p-4">
                <div className="text-[13px] text-white truncate mb-4" title={songToAdd.name}>{songToAdd.name}</div>
                <div className="space-y-1">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => addSongToPlaylist(playlist.id, songToAdd)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-white/5 rounded-sm transition-colors"
                    >
                      <span className="min-w-0 text-[12px] text-white truncate">{playlist.name}</span>
                      <span className="text-[10px] text-white/35">{playlist.songs.length}</span>
                    </button>
                  ))}
                </div>
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createPlaylistAndAddSong();
                  }}
                >
                  <input
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="新建歌单"
                    className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-[12px] text-white outline-none focus:border-white/30"
                  />
                  <button
                    type="submit"
                    className="h-9 w-9 flex-shrink-0 rounded-sm text-black flex items-center justify-center disabled:opacity-50"
                    style={{ backgroundColor: accentHex }}
                    disabled={!newPlaylistName.trim()}
                    title="创建歌单"
                  >
                    <Plus size={15} />
                  </button>
                </form>
              </div>
            </MobileOverlay>
          )}

          {/* Mobile Menu FAB */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="fixed bottom-[80px] right-[16px] z-50 w-[48px] h-[48px] rounded-full flex items-center justify-center shadow-lg pointer-events-auto"
            style={{ backgroundColor: accentHex, color: '#000' }}
          >
            <Menu size={20} />
          </button>

          {/* Mobile Menu Overlay */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-[70] pointer-events-auto">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
              <div
                className="absolute bottom-[140px] right-[16px] w-[180px] border border-white/10 rounded-sm overflow-hidden shadow-2xl"
                style={{ background: 'rgba(5,10,15,0.96)' }}
              >
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowFreqPanel(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Radio size={14} /> 频率触发
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowSearchPanel(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Search size={14} /> 搜索
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowPlaylistPanel(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 transition-colors"
                >
                  <ListMusic size={14} /> 播放列表
                </button>
                <div className="border-t border-white/5 my-1" />
                <button
                  onClick={() => { setMobileMenuOpen(false); loadDemo(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Music size={14} /> 示例
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); fileInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Upload size={14} /> 上传
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (engine.isCapturing) {
                      engine.stopCapture();
                      setTrackName('未选择曲目');
                      setArtistName('');
                    } else {
                      engine.startCapture().then(() => {
                        if (engine.isCapturing) setTrackName('系统音频录制');
                      });
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] transition-colors ${isCapturing ? 'text-[#ef4444]' : 'text-white/80 hover:bg-white/5'}`}
                >
                  <Radio size={14} /> {isCapturing ? '停止录制' : '录制'}
                </button>
                <div className="border-t border-white/5 my-1" />
                <button
                  onClick={() => {
                    const keys = ['auto', ...Object.keys(themes)];
                    const nextIndex = (keys.indexOf(theme) + 1) % keys.length;
                    onThemeChange(keys[nextIndex]);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Palette size={14} /> 主题: {theme === 'auto' ? '随歌自适应' : themes[theme]?.name}
                </button>
              </div>
            </div>
          )}

          {/* Mobile Bottom Player Bar */}
          {isMobile && hasTrack && (
            <MobilePlayerBar
              trackName={trackName}
              isCapturing={isCapturing}
              theme={theme}
              accentHex={accentHex}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              togglePlay={togglePlay}
              playFromQueue={playFromQueue}
              getCurrentQueue={getCurrentQueue}
              formatTime={formatTime}
              volume={volume}
              setVolume={setVolume}
              songToAdd={songToAdd}
              newPlaylistName={newPlaylistName}
              setNewPlaylistName={setNewPlaylistName}
              addSongToPlaylist={addSongToPlaylist}
              createPlaylistAndAddSong={createPlaylistAndAddSong}
              playMode={playMode}
              setPlayMode={setPlayMode}
              onThemeChange={onThemeChange}
              onClose={() => {
                setPlayQueue([]);
                setCurrentSongId(null);
                setTrackName('未选择曲目');
                setArtistName('');
                setLyricsText('');
                engine.pause();
              }}
            />
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="audio/*,.lrc"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Desktop Visualizer Overlay (always visible) */}
          <VisualizerOverlay
            accentHex={accentHex}
            isPlaying={isPlaying}
            isCapturing={isCapturing}
            barCount={barCount}
          />
        </>
      )}

      {/* ==================== SHARED COMPONENTS ==================== */}

      {/* Lyrics Display */}
      {hasTrack && lyricsText && (
        <LyricsDisplay lrcText={lyricsText} currentTime={currentTime} accentHex={accentHex} isPlaying={isPlaying} isMobile={isMobile} isVisible={lyricsVisible} lyricsStyle={lyricsStyle} />
      )}

      {/* 频率触发 Panel (shared - already works on both) */}
      {showFreqPanel && (
        <FreqTriggerPanelWrapper onClose={() => setShowFreqPanel(false)} accentHex={accentHex} />
      )}

      {/* Delete Confirm Modal (shared) */}
      {pendingDelete && (
        <div className="absolute inset-0 z-[120] pointer-events-auto flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[320px] border border-white/10 rounded-sm p-5" style={{ background: 'rgba(5,10,15,0.96)' }}>
            <div className="text-[12px] uppercase tracking-[0.2em] text-white/70 mb-3">
              确认删除
            </div>
            <div className="text-[13px] text-white/80 leading-relaxed mb-5">
              Delete {pendingDelete.type === 'playlist' ? 'playlist' : 'song'} <span className="text-white">{pendingDelete.label}</span>?
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-3 py-2 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/45 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmPendingDelete}
                className="px-3 py-2 rounded-sm border border-[#ef4444]/40 text-[10px] uppercase tracking-[0.15em] text-[#ef4444] hover:bg-[#ef4444] hover:text-black"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        accentHex={accentHex}
      />

      {/* Play History Panel */}
      <PlayHistory
        isOpen={showPlayHistory}
        onClose={() => setShowPlayHistory(false)}
        onLoadSong={(id: number) => {
          const queue = getCurrentQueue();
          const song = queue.find((s: NeteaseSong) => s.id === id);
          if (song) loadNeteaseSong(song, queue);
        }}
        accentHex={accentHex}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        barCount={barCount}
        onBarCountChange={setBarCount}
        lyricsVisible={lyricsVisible}
        onLyricsVisibleChange={setLyricsVisible}
        lyricsStyle={lyricsStyle}
        onLyricsStyleChange={setLyricsStyle}
        accentHex={accentHex}
        maxHistoryItems={maxHistoryItems}
        onMaxHistoryChange={setMaxHistoryItems}
        showStats={showStats}
        onStatsVisibleChange={setShowStats}
        uiHidden={uiHidden}
        onUiHiddenChange={onUiHiddenChange}
        userQuality={userQuality}
        onQualityChange={onQualityChange}
        userAntialias={userAntialias}
        onAntialiasChange={onAntialiasChange}
      />

      {/* First-Time Tutorial */}
      <FirstTimeTutorial accentHex={accentHex} />

      {/* Brand Mark (outside pointer-events-none wrapper) */}
      {watermarkVisible ? (
        <div
          className={`fixed z-[200] pointer-events-auto select-none cursor-pointer ${isMobile ? 'top-[12px] left-[16px]' : 'top-[40px] left-[100px]'}`}
          onClick={() => setWatermarkVisible(false)}
        >
          <div className={`font-black tracking-[-1px] text-white leading-none ${isMobile ? 'text-[18px]' : 'text-[24px]'}`}>AJIN.</div>
          <div className={`${isMobile ? 'text-[7px] tracking-[0.2em]' : 'text-[10px] tracking-[0.3em]'} text-white/30 mt-0.5`}>LANHU199-PLUS</div>
        </div>
      ) : (
        <div className={`fixed z-[200] pointer-events-auto select-none cursor-pointer ${isMobile ? 'top-[12px] left-[16px]' : 'top-[40px] left-[100px]'}`}>
          <button onClick={() => setWatermarkVisible(true)} className={`text-white/20 hover:text-white/60 tracking-[0.15em] uppercase ${isMobile ? 'text-[9px]' : 'text-[10px]'}`} title="显示水印">⊕</button>
        </div>
      )}
    </div>
  );
}

/* ==================== MOBILE OVERLAY ==================== */

function MobileOverlay({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
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

/* ==================== SEARCH PANEL CONTENT ==================== */

function SearchPanelContent({
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

/* ==================== PLAYLIST PANEL CONTENT ==================== */

function PlaylistPanelContent({
  playlists, activePlaylist, activePlaylistId, setActivePlaylistId,
  currentSongId, loadNeteaseSong, setPendingDelete, playlistsLength, onClose, accentHex
}: {
  playlists: SavedPlaylist[]; activePlaylist: SavedPlaylist | undefined;
  activePlaylistId: string; setActivePlaylistId: (id: string) => void;
  currentSongId: number | null; loadNeteaseSong: (song: NeteaseSong, queue?: NeteaseSong[]) => void;
  setPendingDelete: (pd: PendingDelete) => void; playlistsLength: number;
  onClose: () => void; accentHex: string;
}) {
  return (
    <>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-white/70">
            <ListMusic size={15} />
            播放列表
          </div>
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">关闭</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setActivePlaylistId(playlist.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.12em] transition-colors ${activePlaylist?.id === playlist.id ? 'text-black border-transparent' : 'text-white/45 border-white/10 hover:text-white'}`}
                style={{ backgroundColor: activePlaylist?.id === playlist.id ? accentHex : 'transparent' }}
              >
                {playlist.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => activePlaylist && setPendingDelete({ type: 'playlist', playlistId: activePlaylist.id, label: activePlaylist.name })}
            disabled={!activePlaylist || playlistsLength <= 1}
            className="h-8 w-8 flex-shrink-0 rounded-sm border border-white/10 text-white/45 hover:text-[#ef4444] disabled:opacity-20 disabled:hover:text-white/45 flex items-center justify-center"
            title="删除歌单"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="max-h-[52vh] overflow-y-auto">
        {activePlaylist && activePlaylist.songs.length > 0 ? activePlaylist.songs.map((song) => (
          <button
            key={song.id}
            onClick={() => loadNeteaseSong(song, activePlaylist.songs)}
            className="relative w-full text-left px-5 py-4 pr-16 border-b border-white/5 hover:bg-white/5 transition-colors"
          >
            <div className="text-[13px] text-white truncate">{song.name}</div>
            <div className="mt-1 text-[11px] text-white/45 truncate">{song.artist || '未知歌手'} - {song.album || '未知专辑'}</div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: 'song', playlistId: activePlaylist.id, songId: song.id, label: song.name }); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setPendingDelete({ type: 'song', playlistId: activePlaylist.id, songId: song.id, label: song.name }); }
              }}
              className="absolute right-5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-sm border border-white/10 text-white/45 hover:text-[#ef4444] transition-colors flex items-center justify-center"
              title="从歌单移除"
            >
              <Trash2 size={14} />
            </span>
          </button>
        )) : (
          <div className="px-5 py-8 text-[12px] text-white/40">歌单中暂无歌曲</div>
        )}
      </div>
    </>
  );
}

/* ==================== SONG-TO-ADD PANEL ==================== */

function SongToAddPanel({
  songToAdd, playlists, newPlaylistName, setNewPlaylistName,
  addSongToPlaylist, createPlaylistAndAddSong, onClose, accentHex
}: {
  songToAdd: NeteaseSong; playlists: SavedPlaylist[];
  newPlaylistName: string; setNewPlaylistName: (v: string) => void;
  addSongToPlaylist: (id: string, song: NeteaseSong) => void;
  createPlaylistAndAddSong: () => void; onClose: () => void; accentHex: string;
}) {
  return (
    <>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-2">添加到歌单</div>
            <div className="text-[13px] text-white truncate" title={songToAdd.name}>{songToAdd.name}</div>
          </div>
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">关闭</button>
        </div>
      </div>
      <div className="p-3 border-b border-white/10">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            onClick={() => addSongToPlaylist(playlist.id, songToAdd)}
            className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-white/5 rounded-sm transition-colors"
          >
            <span className="min-w-0 text-[12px] text-white truncate">{playlist.name}</span>
            <span className="text-[10px] text-white/35">{playlist.songs.length}</span>
          </button>
        ))}
      </div>
      <form className="p-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); createPlaylistAndAddSong(); }}>
        <input
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          placeholder="新建歌单"
          className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-[12px] text-white outline-none focus:border-white/30"
        />
        <button type="submit" className="h-9 w-9 flex-shrink-0 rounded-sm text-black flex items-center justify-center disabled:opacity-50"
          style={{ backgroundColor: accentHex }} disabled={!newPlaylistName.trim()} title="创建歌单">
          <Plus size={15} />
        </button>
      </form>
    </>
  );
}

/* ==================== DESKTOP PLAYER PANEL ==================== */

/* ==================== QUEUE PANEL CONTENT ==================== */

function QueuePanelContent({
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

/* ==================== MOBILE PLAYER BAR ==================== */

function MobilePlayerBar({
  trackName, isCapturing, theme, accentHex,
  currentTime, duration, isPlaying, togglePlay,
  playFromQueue, getCurrentQueue, formatTime,
  volume, setVolume, songToAdd, newPlaylistName, setNewPlaylistName,
  addSongToPlaylist, createPlaylistAndAddSong, onClose,
  playMode, setPlayMode, onThemeChange,
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

/* ==================== 频率触发 PANEL ==================== */

import { TriggerPreset } from '../../lib/AudioEngine';

function FreqTriggerPanelWrapper({ onClose, accentHex }: { onClose: () => void, accentHex: string }) {
  const [action, setAction] = useState<'Pulse' | 'Meteor'>('Meteor');
  return (
    <FreqTriggerPanel key={action} action={action} setAction={setAction} onClose={onClose} accentHex={accentHex} />
  );
}

function FreqTriggerPanel({ action, setAction, onClose, accentHex }: { action: 'Pulse' | 'Meteor', setAction: (a: 'Pulse' | 'Meteor') => void, onClose: () => void, accentHex: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getConfig = () => action === 'Pulse' ? engine.pulseTrigger : engine.meteorTrigger;

  const [triggerPoint, setTriggerPoint] = useState({
    x: getConfig().freqIndex >= 0 ? getConfig().freqIndex / 512 : 0.5,
    y: getConfig().threshold
  });
  const [isEnabled, setIsEnabled] = useState(getConfig().enabled);
  const [mode, setMode] = useState<TriggerPreset>(getConfig().mode);
  const [sensitivity, setSensitivity] = useState(getConfig().sensitivity);
  const [cooldown, setCooldown] = useState(getConfig().cooldown);
  const [pulseStrength, setPulseStrength] = useState(getConfig().pulseStrength);
  const [bandStart, setBandStart] = useState(getConfig().bandStart);
  const [bandEnd, setBandEnd] = useState(getConfig().bandEnd);
  const isDragging = useRef(false);

  // Sync state TO engine when parameters change
  useEffect(() => {
     const c = getConfig();
     c.enabled = isEnabled;
     c.mode = mode;
     c.sensitivity = sensitivity;
     c.cooldown = cooldown;
     c.pulseStrength = pulseStrength;
     c.bandStart = bandStart;
     c.bandEnd = bandEnd;

     if (mode === 'Advanced') {
         c.freqIndex = Math.floor(triggerPoint.x * 512);
         c.threshold = triggerPoint.y;
     } else {
         c.freqIndex = -1;
     }
  }, [isEnabled, mode, sensitivity, cooldown, pulseStrength, bandStart, bandEnd, triggerPoint]);

  const handleModeChange = (newMode: TriggerPreset) => {
    setMode(newMode);
  };

  const presets: TriggerPreset[] = ['Auto Beat', 'Advanced'];

  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      for(let i=1; i<10; i++) {
         ctx.moveTo(0, height * i / 10);
         ctx.lineTo(width, height * i / 10);
         ctx.moveTo(width * i / 10, 0);
         ctx.lineTo(width * i / 10, height);
      }
      ctx.stroke();

      const data = engine.getRawFrequencyData();
      const binCount = data.length || 512;

      // Draw highlighted band
      const [startBin, endBin] = getConfig().getTriggerRange();
      const startX = (startBin / binCount) * width;
      const endX = (endBin / binCount) * width;

      ctx.fillStyle = mode === 'Advanced' ? 'rgba(255,255,255,0.02)' : `${accentHex}20`;
      ctx.fillRect(startX, 0, Math.max(1, endX - startX), height);

      if (mode !== 'Advanced') {
         ctx.strokeStyle = accentHex + '80';
         ctx.lineWidth = 1;
         ctx.beginPath();
         ctx.moveTo(endX, 0);
         ctx.lineTo(endX, height);
         ctx.stroke();
      }

      // Draw spectrum
      ctx.fillStyle = accentHex + '40';
      ctx.beginPath();
      ctx.moveTo(0, height);

      for(let i = 0; i < binCount; i++) {
         const x = (i / binCount) * width;
         const val = data[i] / 255.0;
         const y = height - (val * height);
         ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      if (mode === 'Advanced') {
          const tx = triggerPoint.x * width;
          const ty = height - (triggerPoint.y * height);

          ctx.beginPath();
          ctx.moveTo(tx, 0);
          ctx.lineTo(tx, height);
          ctx.moveTo(0, ty);
          ctx.lineTo(width, ty);
          ctx.strokeStyle = accentHex;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(tx, ty, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
      } else {
          const evE = getConfig().lastEvalEnergy;
          const evThresh = getConfig().lastEvalThresh;

          const eY = height - (evE * height);
          const tY = height - (evThresh * height);

          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.moveTo(0, tY);
          ctx.lineTo(width, tY);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.stroke();
          ctx.setLineDash([]);

          const cx = (startX + endX) / 2;
          ctx.beginPath();
          ctx.arc(cx, eY, 6, 0, Math.PI * 2);
          ctx.fillStyle = evE > evThresh ? accentHex : 'rgba(255,255,255,0.5)';
          ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [accentHex, triggerPoint, mode]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'Advanced') return;
    isDragging.current = true;
    updateTriggerFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || mode !== 'Advanced') return;
    updateTriggerFromEvent(e);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const updateTriggerFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));

    setTriggerPoint({ x, y });
    const config = action === 'Meteor' ? engine.meteorTrigger : engine.pulseTrigger;
    config.freqIndex = Math.floor(x * 512);
    config.threshold = y;
  };

  // Detect if on mobile for responsive layout inside panel
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="absolute inset-0 z-[100] backdrop-blur-md bg-black/50 flex flex-col items-center justify-center pointer-events-auto">
       <div className="w-full max-w-[800px] mx-2 border border-white/10 rounded-xl p-4 sm:p-8 transform transition-all shadow-2xl max-h-screen overflow-y-auto" style={{ background: 'rgba(5, 10, 15, 0.95)' }}>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
             <div className="flex flex-wrap items-center gap-4">
               <h2 className="text-lg sm:text-xl font-light tracking-widest text-white">频率触发</h2>
               <div className="flex flex-wrap items-center gap-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={isEnabled}
                     onChange={(e) => setIsEnabled(e.target.checked)}
                     className="w-4 h-4 rounded-sm border-white/20 bg-black/50"
                     style={{ accentColor: accentHex }}
                   />
                   <span className="text-[10px] uppercase tracking-widest text-white/50">启用</span>
                 </label>

                 {isEnabled && (
                   <div className="flex items-center rounded overflow-hidden border border-white/10 text-[10px] uppercase tracking-widest">
                     <button
                       onClick={() => setAction('Pulse')}
                       className={`px-3 py-1 transition-colors ${action === 'Pulse' ? 'text-black' : 'text-white/50 hover:bg-white/5'}`}
                       style={{ backgroundColor: action === 'Pulse' ? accentHex : 'transparent' }}
                     >
                       Pulse
                     </button>
                     <button
                       onClick={() => setAction('Meteor')}
                       className={`px-3 py-1 transition-colors ${action === 'Meteor' ? 'text-black' : 'text-white/50 hover:bg-white/5'}`}
                       style={{ backgroundColor: action === 'Meteor' ? accentHex : 'transparent' }}
                     >
                       Meteor
                     </button>
                   </div>
                 )}
               </div>
             </div>
             <button onClick={onClose} className="text-white/50 hover:text-white uppercase tracking-widest text-[10px]">关闭</button>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {presets.map(p => (
               <button
                  key={p}
                  onClick={() => handleModeChange(p)}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm border transition-colors ${
                     mode === p ? 'bg-white/10 text-white border-white/20' : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
                  }`}
               >
                  {p}
               </button>
            ))}
          </div>

          <p className="text-[11px] text-white/40 mb-6 font-mono leading-relaxed">
            {mode === 'Advanced'
              ? "Drag the crosshair to set the target frequency (X) and threshold (Y).\nWhen the spectrum exceeds this threshold, a visual pulse is triggered."
              : `Dynamic ${mode} detection enabled. Pulses trigger when instantaneous energy significantly exceeds the rolling average of this specific frequency band.`}
          </p>
          <div className={`relative w-full aspect-[2/1] bg-black/50 border border-white/5 rounded overflow-hidden ${mode === 'Advanced' ? 'cursor-crosshair' : ''}`}>
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              className="w-full h-full block"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          {mode === 'Auto Beat' && (
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>灵敏度</span>
                    <span style={{ color: accentHex }}>{sensitivity.toFixed(2)}</span>
                 </div>
                 <input type="range" min="0" max="1" step="0.05" value={sensitivity} onChange={e => setSensitivity(parseFloat(e.target.value))} className="w-full accent-current h-1" style={{ accentColor: accentHex }}/>
               </div>
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>冷却(帧)</span>
                    <span style={{ color: accentHex }}>{cooldown}</span>
                 </div>
                 <input type="range" min="0" max="300" step="1" value={cooldown} onChange={e => setCooldown(parseInt(e.target.value))} className="w-full accent-current h-1" style={{ accentColor: accentHex }}/>
               </div>
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>频率范围 ({bandStart} - {bandEnd})</span>
                 </div>
                 <div className="flex gap-2">
                   <input type="range" min="0" max="250" step="1" value={bandStart} onChange={e => setBandStart(Math.min(parseInt(e.target.value), bandEnd - 1))} className="w-1/2 accent-current h-1" style={{ accentColor: accentHex }}/>
                   <input type="range" min="2" max="256" step="1" value={bandEnd} onChange={e => setBandEnd(Math.max(parseInt(e.target.value), bandStart + 1))} className="w-1/2 accent-current h-1" style={{ accentColor: accentHex }}/>
                 </div>
               </div>
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>脉冲强度</span>
                    <span style={{ color: accentHex }}>{pulseStrength.toFixed(2)}</span>
                 </div>
                 <input type="range" min="0" max="5" step="0.1" value={pulseStrength} onChange={e => setPulseStrength(parseFloat(e.target.value))} className="w-full accent-current h-1" style={{ accentColor: accentHex }}/>
               </div>
            </div>
          )}
       </div>
    </div>
  );
}

/* ==================== STATS PANEL ==================== */

function StatsPanel({ accentHex }: { accentHex: string }) {
  const [data, setData] = useState({ bass: 0, mid: 0, treble: 0, energy: 0 });

  useEffect(() => {
    let animationFrameId: number;
    const poll = () => {
      setData(engine.getAudioData());
      animationFrameId = requestAnimationFrame(poll);
    };
    poll();
    return () => cancelAnimationFrame(animationFrameId);
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
