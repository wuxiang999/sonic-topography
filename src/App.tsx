// Suppress THREE.Clock deprecation warning (R3F uses it internally, not our code)
const _warn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && /^THREE\.Clock: This module has been deprecated/.test(args[0])) return;
  _warn(...args);
};

import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI/UI';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';

const MapScene = lazy(() => import('./components/AudioVisualizer/MapScene'));
import {
  BUILT_IN_THEME_IDS,
  CUSTOM_THEME_ID,
  createCustomThemeColors,
  readActiveCustomThemeStorage,
  readActiveThemeStorage,
  readCustomThemeStorage,
  readThemeRotationStorage,
  themes,
  writeActiveCustomThemeStorage,
  writeActiveThemeStorage,
  writeCustomThemeStorage,
  writeThemeRotationStorage,
  type CustomThemeSettings,
  type ThemeRotationSettings,
} from './lib/themes';
import { readGroundEqSettingsStorage, writeGroundEqSettingsStorage, type StoredGroundEqSettings } from './lib/groundEqSettings';
import { engine } from './lib/AudioEngine';
import { getDevicePerformance } from './lib/performance';
import { DEFAULT_SCENE_SETTINGS, type SceneSettings } from './components/UI/SettingsPanel';
import { SettingsProvider } from './store/SettingsContext';

// ── Initial state helpers ─────────────────────────────────────

function readInitialCustomThemeState() {
  const presets = readCustomThemeStorage();
  return {
    presets,
    activeId: readActiveCustomThemeStorage(presets),
  };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

function useRenderMode() {
  const [renderMode, setRenderMode] = useState(false);
  const [songId, setSongId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('render') === '1') {
      setRenderMode(true);
      setSongId(params.get('song') || '32701152');
    }
  }, []);
  return { renderMode, songId };
}

export default function App() {
  // ── Custom theme system state ──────────────────────────────
  const [theme, setTheme] = useState(readActiveThemeStorage);
  const [groundEqSettings, setGroundEqSettings] = useState<StoredGroundEqSettings>(readGroundEqSettingsStorage);
  const [customThemeState, setCustomThemeState] = useState(readInitialCustomThemeState);
  const customThemes = customThemeState.presets;
  const activeCustomThemeId = customThemeState.activeId;
  const activeCustomTheme = customThemes.find((preset) => preset.id === activeCustomThemeId) || customThemes[0];
  const availableRotationThemeIds = [...BUILT_IN_THEME_IDS, ...customThemes.map((preset) => preset.id)];
  const [themeRotation, setThemeRotation] = useState<ThemeRotationSettings>(() => readThemeRotationStorage(availableRotationThemeIds));
  const resolvedTheme = theme === CUSTOM_THEME_ID
    ? createCustomThemeColors(activeCustomTheme)
    : (themes[theme] || themes['nocturnal']);
  const sceneRotationSpeed = theme === CUSTOM_THEME_ID
    ? (activeCustomTheme?.rotationSpeed ?? resolvedTheme.uRotationSpeed)
    : resolvedTheme.uRotationSpeed;
  const showPlayerPanel = theme === CUSTOM_THEME_ID
    ? (activeCustomTheme?.showPlayerPanel ?? resolvedTheme.uShowPlayerPanel)
    : resolvedTheme.uShowPlayerPanel;

  // ── Scene settings (fog, band gains, etc.) ────────────────
  const SCENE_SETTINGS_KEY = 'sonic-topography-scene-settings-v1';
  function readSceneSettings(): SceneSettings {
    try {
      const raw = localStorage.getItem(SCENE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SCENE_SETTINGS, ...parsed };
      }
    } catch {}
    return { ...DEFAULT_SCENE_SETTINGS };
  }
  const [sceneSettings, setSceneSettings] = useState<SceneSettings>(readSceneSettings);
  const handleSceneSettingsChange = (settings: SceneSettings) => {
    setSceneSettings(settings);
    try {
      localStorage.setItem(SCENE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  };

  // ── Other state ────────────────────────────────────────────
  const [currentCover, setCurrentCover] = useState('');
  const [userQuality, setUserQuality] = useState<'low' | 'medium' | 'high' | null>(null);
  const [userAntialias, setUserAntialias] = useState<boolean | null>(null);
  const [uiHidden, setUiHidden] = useState(false);
  const isMobile = useIsMobile();
  const { renderMode, songId } = useRenderMode();

  // ── Theme management ───────────────────────────────────────

  const activateThemeId = (themeId: string) => {
    if (BUILT_IN_THEME_IDS.includes(themeId)) {
      setTheme(themeId);
      writeActiveThemeStorage(themeId);
      return;
    }

    if (customThemes.some((preset) => preset.id === themeId)) {
      setCustomThemeState((prev) => ({ ...prev, activeId: themeId }));
      writeActiveCustomThemeStorage(themeId);
      setTheme(CUSTOM_THEME_ID);
      writeActiveThemeStorage(CUSTOM_THEME_ID);
    }
  };

  const updateCustomThemes = (settings: CustomThemeSettings[], activeId = activeCustomThemeId) => {
    setCustomThemeState({ presets: settings, activeId });
    writeCustomThemeStorage(settings);
    writeActiveCustomThemeStorage(activeId);
  };

  const updateThemeRotation = (settings: ThemeRotationSettings) => {
    setThemeRotation(settings);
    writeThemeRotationStorage(settings, availableRotationThemeIds);
  };

  const updateGroundEqSettings = (settings: StoredGroundEqSettings) => {
    setGroundEqSettings(settings);
    writeGroundEqSettingsStorage(settings);
  };

  // ── Theme rotation timer ───────────────────────────────────
  const { enabled: rotationEnabled, intervalSeconds: rotationInterval, themeIds: rotationThemeIds } = themeRotation;
  useEffect(() => {
    if (!rotationEnabled || rotationThemeIds.length < 2) return;

    const timer = window.setInterval(() => {
      const currentThemeId = theme === CUSTOM_THEME_ID ? activeCustomThemeId : theme;
      const currentIndex = rotationThemeIds.indexOf(currentThemeId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % rotationThemeIds.length : 0;
      activateThemeId(rotationThemeIds[nextIndex]);
    }, rotationInterval * 1000);

    return () => window.clearInterval(timer);
  }, [rotationEnabled, rotationInterval, rotationThemeIds, theme, activeCustomThemeId, customThemes]);

  // Update available rotation IDs when custom themes change
  useEffect(() => {
    const normalized = readThemeRotationStorage(availableRotationThemeIds);
    setThemeRotation((current) => {
      const nextThemeIds = current.themeIds.filter((id) => availableRotationThemeIds.includes(id));
      const next = { ...current, themeIds: nextThemeIds.length ? nextThemeIds : normalized.themeIds };
      writeThemeRotationStorage(next, availableRotationThemeIds);
      return next;
    });
  }, [customThemes.length]);

  // ── Load trigger settings from storage on mount ────────────
  useEffect(() => {
    engine.loadTriggerSettingsFromStorage();
  }, []);

  // ── DJ mode auto-detection ──────────────────────────────
  const [isDJMode, setIsDJMode] = useState(false);
  const djDetectionRef = useRef<number[]>([]);
  useEffect(() => {
    if (renderMode) return;
    const interval = setInterval(() => {
      const data = engine.getAudioData();
      const energy = data.energy || 0;
      const density = data.density || 0;
      const sharpness = data.sharpness || 0;

      djDetectionRef.current.push(energy);
      if (djDetectionRef.current.length > 60) djDetectionRef.current.shift();

      if (djDetectionRef.current.length >= 30) {
        const avg = djDetectionRef.current.reduce((a, b) => a + b, 0) / djDetectionRef.current.length;
        const variance = djDetectionRef.current.reduce((s, v) => s + (v - avg) ** 2, 0) / djDetectionRef.current.length;
        const rhythmic = variance < 0.008 && avg > 0.35;
        const intense = energy > 0.55 && density > 0.55 && sharpness > 0.4;
        setIsDJMode(rhythmic || intense);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [renderMode]);

  // ── Render mode duration ──────────────────────────────────
  const renderDuration = useRef(
    typeof window !== 'undefined'
      ? Number(new URLSearchParams(window.location.search).get('dur')) || 30
      : 30
  );

  // ===== Render Mode =====
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__renderMode = renderMode;
    }
  }, [renderMode]);
  const autoPlayed = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Expose engine & state for puppeteer diagnostics (DEV only)
  useEffect(() => {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      (window as any).__engine = engine;
      const interval = setInterval(() => {
        (window as any).__audioCtxState = (engine as any).audioCtx?.state;
        (window as any).__audioPaused = engine.audioElement?.paused;
        (window as any).__audioCurrentTime = engine.audioElement?.currentTime;
      }, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  // Auto-play and record in render mode
  useEffect(() => {
    if (!renderMode || !songId || autoPlayed.current) return;
    autoPlayed.current = true;

    const startRender = async () => {
      try {
        console.log('Render mode: starting...');
        await new Promise(r => setTimeout(r, 3000));

        const canvas = document.querySelector('canvas');
        if (!canvas) {
          console.error('Canvas not found for recording');
          (window as any).__recorderState = 'error:canvas-not-found';
          return;
        }

        console.log('Render mode: fetching audio file...');
        (window as any).__recorderState = 'fetching-audio';

        const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('Render mode: AudioContext created, state=' + actx.state);

        const audioResp = await fetch('/music/static-audio/grey-track.mp3');
        if (!audioResp.ok) {
          console.error('Render mode: audio fetch failed: ' + audioResp.status);
          (window as any).__recorderState = 'error:fetch-failed';
          return;
        }
        const audioBuf = await audioResp.arrayBuffer();
        console.log('Render mode: audio fetched, ' + audioBuf.byteLength + ' bytes');

        const decodedAudio = await actx.decodeAudioData(audioBuf);
        console.log('Render mode: audio decoded, duration=' + decodedAudio.duration + 's channels=' + decodedAudio.numberOfChannels);

        const analyserNode = actx.createAnalyser();
        analyserNode.fftSize = 1024;
        analyserNode.smoothingTimeConstant = 0.8;

        const bufferSource = actx.createBufferSource();
        bufferSource.buffer = decodedAudio;
        bufferSource.connect(analyserNode);
        analyserNode.connect(actx.destination);
        bufferSource.start(0);

        engine.setRenderModeAudio(actx, analyserNode);

        console.log('Render mode: audio playing via BufferSource');

        (window as any).__recorderState = 'setup';

        if (!document.body.contains(canvas)) {
          console.error('Render mode: canvas not in DOM');
          return;
        }
        console.log('Render mode: canvas in DOM, capturing stream...');

        const stream = canvas.captureStream(12);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 800000,
        });
        recorderRef.current = recorder;
        chunksRef.current = [];
        (window as any).__recorderState = 'created';

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
          (window as any).__recorderState = `recording:${chunksRef.current.length}chunks`;
        };

        recorder.onstop = async () => {
          (window as any).__renderRunning = false;
          console.log(`Render mode: recording stopped, ${chunksRef.current.length} chunks`);
          if (chunksRef.current.length === 0) return;
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          console.log(`Render mode: recording complete, ${blob.size} bytes`);

          const reader = new FileReader();
          reader.onload = function() {
            (window as any).__renderResult = reader.result;
            (window as any).__renderDone = true;
            (window as any).__recorderState = 'done';
            console.log('Render mode: data ready for extraction');
          };
          reader.readAsDataURL(blob);
        };

        recorder.start(5000);
        (window as any).__recorderState = 'started';

        bufferSource.onended = () => {
          console.log('Render mode: song ended, stopping recording');
          setTimeout(() => {
            if (recorderRef.current && recorderRef.current.state === 'recording') {
              recorderRef.current.stop();
            }
          }, 1500);
        };

        (window as any).__renderRunning = true;
        console.log('Render mode: running...');

        const durMs = renderDuration.current * 1000;
        setTimeout(() => {
          if (bufferSource && (bufferSource as any).playbackState !== 'finished') {
            console.log(`Render mode: duration reached (${renderDuration.current}s), stopping`);
            if (recorderRef.current && recorderRef.current.state === 'recording') {
              recorderRef.current.stop();
            }
          }
        }, durMs);

      } catch (err) {
        console.error('Render mode error:', err);
        (window as any).__renderError = String(err);
        (window as any).__renderDone = true;
        (window as any).__renderRunning = false;
        (window as any).__recorderState = `error:${String(err)}`;
      }
    };

    startRender();

    return () => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
    };
  }, [renderMode, songId]);

  // ── Keyboard shortcuts ────────────────────────────────────
  const [renderRecHidden, setRenderRecHidden] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (engine.audioElement) {
            if (engine.isPlaying) engine.pause();
            else engine.play();
          }
          break;
        case 'ArrowLeft':
          if (engine.audioElement) engine.audioElement.currentTime = Math.max(0, engine.audioElement.currentTime - 5);
          break;
        case 'ArrowRight':
          if (engine.audioElement) engine.audioElement.currentTime = Math.min(engine.audioElement.duration, engine.audioElement.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (engine.audioElement) engine.audioElement.volume = Math.min(1, engine.audioElement.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (engine.audioElement) engine.audioElement.volume = Math.max(0, engine.audioElement.volume - 0.1);
          break;
        case 'KeyF':
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
          break;
        case 'KeyM':
          if (engine.audioElement) {
            engine.audioElement.muted = !engine.audioElement.muted;
          }
          break;
        case 'KeyU':
          e.preventDefault();
          setUiHidden(prev => !prev);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Background color from resolved theme ──────────────────
  const bgDark = `#${resolvedTheme.uBaseColor1.getHexString()}`;

  // ── Performance auto-detection ─────────────────────────────
  const perf = getDevicePerformance();
  const effectiveQuality = userQuality || perf.perfLevel;
  const effectiveAntialias = userAntialias !== null ? userAntialias : perf.antialias;

  const qualityDpr: Record<string, [number, number]> = { low: [0.5, 1], medium: [0.75, 1.5], high: [1, 2] };
  const canvasDpr = renderMode ? [1, 1] : qualityDpr[effectiveQuality];
  const canvasPerf = renderMode ? { min: 1 } : { min: 0.3 };
  const canvasGl = renderMode
    ? { antialias: true, alpha: false, powerPreference: 'high-performance' as const, preserveDrawingBuffer: true }
    : { antialias: effectiveAntialias, alpha: false, powerPreference: perf.powerPreference as WebGLPowerPreference, preserveDrawingBuffer: true };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden font-sans transition-colors duration-1000"
      style={{ backgroundColor: bgDark }}
    >
      {!renderMode && (
        <SettingsProvider
          initialTheme={theme}
          initialCustomThemes={customThemes}
          initialActiveCustomThemeId={activeCustomThemeId}
          initialThemeRotation={themeRotation}
          initialGroundEqSettings={groundEqSettings}
          initialSceneSettings={sceneSettings}
          initialUiHidden={uiHidden}
          initialUserQuality={userQuality}
          initialUserAntialias={userAntialias}
          onThemeChange={activateThemeId}
          onCustomThemesChange={updateCustomThemes}
          onThemeRotationChange={updateThemeRotation}
          onGroundEqSettingsChange={updateGroundEqSettings}
          onSceneSettingsChange={handleSceneSettingsChange}
          onUiHiddenChange={setUiHidden}
          onQualityChange={setUserQuality}
          onAntialiasChange={setUserAntialias}
        >
          <UI isMobile={isMobile} onCoverChange={setCurrentCover} />
        </SettingsProvider>
      )}
      <div className={renderMode ? 'fixed inset-0' : `absolute inset-0 ${uiHidden ? 'z-[1]' : 'z-0'}`}>
        <Canvas
          camera={{ position: [35, 25, 35], fov: 45 }}
          dpr={canvasDpr}
          performance={canvasPerf}
          gl={canvasGl}
        >
          <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
            <MapScene
              themeColors={resolvedTheme}
              groundEqSettings={groundEqSettings}
              rotationSpeed={sceneRotationSpeed}
              sceneSettings={sceneSettings}
              isMobile={isMobile}
              perfLevel={effectiveQuality}
              isDJMode={isDJMode}
            />
          </Suspense>
        </Canvas>
      </div>
      {renderMode && !renderRecHidden && (
        <div
          onClick={() => setRenderRecHidden(true)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            color: 'rgba(255,50,50,0.6)',
            fontSize: 13,
            fontFamily: 'monospace',
            pointerEvents: 'auto',
            cursor: 'pointer',
            zIndex: 9999,
          }}
        >
          ● REC
        </div>
      )}
    </div>
  );
}
