import { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { Palette, Plus, ListMusic, Menu, Music, Upload, Radio, Search, Maximize2, History, Cloud, Monitor } from 'lucide-react';
import { engine } from '../../lib/AudioEngine';
import { themes } from '../../lib/themes';
import type { ThemeColors, CustomThemeSettings, ThemeRotationSettings } from '../../lib/themes';
import type { StoredGroundEqSettings } from '../../lib/groundEqSettings';
import { readNeteaseCookieStorage, writeNeteaseCookieStorage } from '../../lib/neteaseCookie';
import { DesktopPlayerPanel } from './DesktopPlayerPanel';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { addToHistory } from './PlayHistory';
import type { LyricsStyleOption, SceneSettings } from './SettingsPanel';

const LyricsDisplay = lazy(() => import('./LyricsDisplay').then(m => ({ default: m.LyricsDisplay })));
const PlayHistory = lazy(() => import('./PlayHistory').then(m => ({ default: m.PlayHistory })));
const SettingsPanel = lazy(() => import('./SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const FirstTimeTutorial = lazy(() => import('./FirstTimeTutorial').then(m => ({ default: m.FirstTimeTutorial })));
import { extractAudioMetadata, extractLyricsFromAudio } from '../../lib/metadata';
import { useSettings } from '../../store/SettingsContext';

// ── Types ──
import type { NeteaseSong, PlayMode } from '../../types';
import { MobileOverlay } from './panels/MobileOverlay';
import { SearchPanelContent } from './panels/SearchPanelContent';
import { PlaylistPanelContent } from './panels/PlaylistPanelContent';
import { SongToAddPanel } from './panels/SongToAddPanel';
import { QueuePanelContent } from './panels/QueuePanelContent';
import { MobilePlayerBar } from './panels/MobilePlayerBar';
const FreqTriggerPanelWrapper = lazy(() => import('./panels/FreqTriggerPanel').then(m => ({ default: m.FreqTriggerPanelWrapper })));
import { StatsPanel } from './panels/StatsPanel';
const NeteasePlaylistsPanel = lazy(() => import('./panels/NeteasePlaylistsPanel').then(m => ({ default: m.NeteasePlaylistsPanel })));
interface SavedPlaylist {
  id: string;
  name: string;
  songs: NeteaseSong[];
}
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
  isMobile?: boolean;
  onCoverChange?: (url: string) => void;
}

export function UI({
  isMobile = false,
  onCoverChange,
}: UIProps) {
  const {
    theme, resolvedTheme, customThemes, activeCustomThemeId,
    themeRotation, groundEqSettings, sceneSettings,
    uiHidden, userQuality, userAntialias,
    setTheme: onThemeChange, setCustomThemes: onCustomThemesChange,
    setThemeRotation: onThemeRotationChange,
    setGroundEqSettings: onGroundEqSettingsChange,
    setSceneSettings: onSceneSettingsChange,
    setUiHidden: onUiHiddenChange,
    setUserQuality: onQualityChange,
    setUserAntialias: onAntialiasChange,
  } = useSettings();
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
  const [maxHistoryItems, setMaxHistoryItems] = useState(50);
  const [showStats, setShowStats] = useState(true);

  // Netease Cookie
  const [showNeteaseCookiePanel, setShowNeteaseCookiePanel] = useState(false);
  const [neteaseCookie, setNeteaseCookie] = useState(readNeteaseCookieStorage);
  const [cookieStatus, setCookieStatus] = useState('');
  const [showNeteasePlaylists, setShowNeteasePlaylists] = useState(false);

  const handleSaveCookie = (cookie: string) => {
    const normalized = writeNeteaseCookieStorage(cookie);
    setNeteaseCookie(normalized || cookie);
    if (normalized) {
      setCookieStatus('Cookie 已保存');
      setTimeout(() => setCookieStatus(''), 3000);
    } else {
      setCookieStatus('Cookie 已清除');
      setTimeout(() => setCookieStatus(''), 3000);
    }
  };

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

  const accentHex = `#${resolvedTheme.uRippleColor.getHexString()}`;

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
              <div className="flex flex-col items-center py-3 gap-4 min-w-[44px] h-full">
                {/* === 功能 === */}
                <button onClick={() => setShowSearchPanel(true)} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="搜索">
                  <Search size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>搜索</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>
                <button onClick={() => setShowPlaylistPanel(true)} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="播放列表">
                  <ListMusic size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>播放列表</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>
                <button onClick={() => setShowPlayHistory(true)} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="播放历史">
                  <History size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>播放历史</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>
                <button onClick={() => setShowFreqPanel(true)} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="频率触发">
                  <Radio size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>频率触发</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>

                <div className="border-t border-white/5 w-5" />

                {/* === 工具 === */}
                <button onClick={loadDemo} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="示例">
                  <Music size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none font-bold" style={{ writingMode: 'vertical-rl' }}>示例</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>
                {neteaseCookie && <>
                  <button onClick={() => setShowNeteaseCookiePanel(true)} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="网易云">
                    <Cloud size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                    <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>网易云</span>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                  </button>
                  <button onClick={() => setShowNeteasePlaylists(true)} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="歌单">
                    <ListMusic size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                    <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>歌单</span>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                  </button>
                </>}
                <button onClick={() => fileInputRef.current?.click()} className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer" title="上传">
                  <Upload size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>上传</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>
                <button
                  onClick={() => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); } else { document.exitFullscreen(); } }}
                  className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer"
                  title="全屏"
                >
                  <Maximize2 size={13} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 group-hover:text-white/50 transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl' }}>全屏</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>
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
                  className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer"
                  title={isCapturing ? '停止捕获系统音频' : '捕获系统音频'}
                >
                  <Monitor size={13} className={`transition-colors ${isCapturing ? 'text-[#ef4444]' : 'text-white/30 group-hover:text-white/70'}`} />
                  <span className={`text-[9px] uppercase tracking-[0.2em] transition-colors whitespace-nowrap leading-none ${isCapturing ? 'text-[#ef4444]' : 'text-white/25 group-hover:text-white/50'}`} style={{ writingMode: 'vertical-rl' }}>{isCapturing ? '停止捕获' : '系统音频'}</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 bg-white/10 rounded-r-full transition-all duration-200" />
                </button>

                <div className="flex-1" />

                {/* === 设置 === */}
                <div className="border-t border-white/5 w-5" />
                <button
                  onClick={() => setShowSettings(true)}
                  className="group relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-sm hover:bg-white/[0.03] transition-colors cursor-pointer"
                  title="设置"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-colors ${showSettings ? 'opacity-100' : 'text-white/30 group-hover:text-white/70'}`} style={{ color: showSettings ? accentHex : undefined }}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span className="text-[9px] uppercase tracking-[0.2em] transition-colors whitespace-nowrap leading-none" style={{ writingMode: 'vertical-rl', color: showSettings ? accentHex : 'rgba(255,255,255,0.25)' }}>设置</span>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-5 rounded-r-full transition-all duration-200" style={{ backgroundColor: showSettings ? accentHex : 'rgba(255,255,255,0)' }} />
                </button>
              </div>
              <input type="file" ref={fileInputRef} accept="audio/*,.lrc" multiple className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* Desktop Search Panel */}
          {showSearchPanel && (
            <div className="absolute top-[40px] left-[100px] w-[360px] max-h-[70vh] z-50 pointer-events-auto backdrop-blur-[20px] border border-white/[0.08] rounded-sm overflow-hidden" style={{ background: 'rgba(5,10,15,0.88)' }}>
              <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
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
            <div className="absolute top-[40px] left-[100px] w-[420px] max-h-[74vh] z-[65] pointer-events-auto backdrop-blur-[20px] border border-white/[0.08] rounded-sm overflow-hidden" style={{ background: 'rgba(5,10,15,0.9)' }}>
              <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
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

          {/* Desktop Netease Cookie Panel */}
          {showNeteaseCookiePanel && (
            <div className="absolute top-[280px] left-[100px] w-[360px] z-[70] pointer-events-auto backdrop-blur-[20px] border border-white/[0.08] rounded-sm overflow-hidden" style={{ background: 'rgba(5,10,15,0.94)' }}>
              <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-white/70">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    网易云 Cookie
                  </div>
                  <button onClick={() => setShowNeteaseCookiePanel(false)} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">关闭</button>
                </div>
                <div className="text-[10px] text-white/40 leading-relaxed mb-3">
                  从浏览器复制你的网易云 Cookie 粘贴到下方，以启用完整搜索权限。
                </div>
                <textarea
                  value={neteaseCookie}
                  onChange={(e) => setNeteaseCookie(e.target.value)}
                  placeholder="粘贴 Cookie..."
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2.5 text-[11px] text-white outline-none focus:border-white/30 min-h-[80px] resize-y placeholder:text-white/20 font-mono"
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="text-[10px] text-white/30">
                    <a href="https://music.163.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">打开网易云音乐</a>
                  </div>
                  <div className="flex items-center gap-2">
                    {cookieStatus && <span className="text-[10px]" style={{ color: accentHex }}>{cookieStatus}</span>}
                    <button
                      onClick={() => handleSaveCookie(neteaseCookie)}
                      className="px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-black rounded-sm hover:scale-105 active:scale-95 transition-all"
                      style={{ backgroundColor: accentHex }}
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Netease Playlists Panel */}
          {showNeteasePlaylists && (
            <Suspense fallback={null}>
              <NeteasePlaylistsPanel
                onClose={() => setShowNeteasePlaylists(false)}
                onPlaySong={(song) => loadNeteaseSong(song)}
                accentHex={accentHex}
              />
            </Suspense>
          )}

          {/* Desktop Song-to-Add Dialog */}
          {songToAdd && (
            <div className="absolute top-[120px] left-[480px] w-[280px] z-[70] pointer-events-auto backdrop-blur-[20px] border border-white/[0.08] rounded-sm overflow-hidden" style={{ background: 'rgba(5,10,15,0.94)' }}>
              <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
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
          {hasTrack && resolvedTheme.uShowPlayerPanel && (
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
                className="absolute bottom-[140px] right-[16px] w-[180px] border border-white/[0.08] rounded-sm overflow-hidden shadow-2xl"
                style={{ background: 'rgba(5,10,15,0.96)' }}>
                <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
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
                <div className="border-t border-white/5 my-1" />
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowSettings(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-white/80 hover:bg-white/5 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> 设置
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
              seekingRef={seekingRef}
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

          {/* Desktop Visualizer Overlay (removed) */}
        </>
      )}

      {/* ==================== SHARED COMPONENTS ==================== */}

      {/* Lyrics Display */}
      {hasTrack && lyricsText && (
        <Suspense fallback={null}>
          <LyricsDisplay lrcText={lyricsText} currentTime={currentTime} accentHex={accentHex} isPlaying={isPlaying} isMobile={isMobile} isVisible={lyricsVisible} lyricsStyle={lyricsStyle} />
        </Suspense>
      )}

      {/* 频率触发 Panel (shared - already works on both) */}
      {showFreqPanel && (
        <Suspense fallback={null}>
          <FreqTriggerPanelWrapper onClose={() => setShowFreqPanel(false)} accentHex={accentHex} />
        </Suspense>
      )}

      {/* Delete Confirm Modal (shared) */}
      {pendingDelete && (
        <div className="absolute inset-0 z-[120] pointer-events-auto flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[320px] border border-white/[0.08] rounded-sm p-5 relative" style={{ background: 'rgba(5,10,15,0.96)' }}>
            <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
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
      <Suspense fallback={null}>
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
      </Suspense>

      {/* Settings Panel */}
      <Suspense fallback={null}>
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          neteaseCookie={neteaseCookie}
          onNeteaseCookieChange={handleSaveCookie}
          lyricsVisible={lyricsVisible}
          onLyricsVisibleChange={setLyricsVisible}
          lyricsStyle={lyricsStyle}
          onLyricsStyleChange={setLyricsStyle}
          accentHex={accentHex}
          maxHistoryItems={maxHistoryItems}
          onMaxHistoryChange={setMaxHistoryItems}
          showStats={showStats}
          onStatsVisibleChange={setShowStats}
        />
      </Suspense>

      {/* First-Time Tutorial */}
      <Suspense fallback={null}>
        <FirstTimeTutorial accentHex={accentHex} isMobile={isMobile} />
      </Suspense>

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


