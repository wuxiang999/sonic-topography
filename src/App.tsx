// Suppress THREE.Clock deprecation warning (R3F uses it internally, not our code)
const _warn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Clock: This module has been deprecated')) return;
  _warn.apply(console, args);
};

import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI/UI';
import { MapScene } from './components/AudioVisualizer/MapScene';
import { useState, useEffect, useRef, useCallback } from 'react';
import { themes } from './lib/themes';
import { engine } from './lib/AudioEngine';
import { getDevicePerformance } from './lib/performance';

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
  const [theme, setTheme] = useState('auto');
  const [currentCover, setCurrentCover] = useState('');
  const [renderRecHidden, setRenderRecHidden] = useState(false);
  const [userQuality, setUserQuality] = useState<'low' | 'medium' | 'high' | null>(null);
  const [userAntialias, setUserAntialias] = useState<boolean | null>(null);
  const [uiHidden, setUiHidden] = useState(false);

  // ── Session restore ─────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('sonic-session');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.theme) setTheme(data.theme);
      }
    } catch {}
  }, []);

  // Save session on state changes
  useEffect(() => {
    try {
      sessionStorage.setItem('sonic-session', JSON.stringify({ theme }));
    } catch {}
  }, [theme]);

  const isMobile = useIsMobile();
  const { renderMode, songId } = useRenderMode();
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
      const now = performance.now();

      djDetectionRef.current.push(energy);
      if (djDetectionRef.current.length > 60) djDetectionRef.current.shift();

      if (djDetectionRef.current.length >= 30) {
        const avg = djDetectionRef.current.reduce((a, b) => a + b, 0) / djDetectionRef.current.length;
        const variance = djDetectionRef.current.reduce((s, v) => s + (v - avg) ** 2, 0) / djDetectionRef.current.length;
        const rhythmic = variance < 0.008 && avg > 0.35; // steady high energy = DJ/electronic
        const intense = energy > 0.55 && density > 0.55 && sharpness > 0.4;
        setIsDJMode(rhythmic || intense);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [renderMode]);
  // Read render duration from URL or default to 30s
  const renderDuration = useRef(
    typeof window !== 'undefined'
      ? Number(new URLSearchParams(window.location.search).get('dur')) || 30
      : 30
  );

  // ===== Render Mode (recording removed from local UI) =====
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__renderMode = renderMode;
    }
  }, [renderMode]);
  const autoPlayed = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Expose engine & state for puppeteer diagnostics
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__engine = engine;
      const interval = setInterval(() => {
        (window as any).__audioCtxState = engine.audioCtx?.state;
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

        // Wait for Three.js canvas to initialize properly
        await new Promise(r => setTimeout(r, 3000));

        const canvas = document.querySelector('canvas');
        if (!canvas) {
          console.error('Canvas not found for recording');
          (window as any).__recorderState = 'error:canvas-not-found';
          return;
        }

        // ===== Render Mode Audio Pipeline =====
        // Bypass HTMLAudioElement + createMediaElementSource entirely.
        // In headless Chrome/ SwiftShader, the MediaElementSourceNode
        // does not deliver data to the AnalyserNode (all zeros).
        // Instead, use fetch + decodeAudioData + BufferSource.

        console.log('Render mode: fetching audio file...');
        (window as any).__recorderState = 'fetching-audio';

        // Create fresh AudioContext
        const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('Render mode: AudioContext created, state=' + actx.state);

        // Fetch the MP3
        const audioResp = await fetch('/music/static-audio/grey-track.mp3');
        if (!audioResp.ok) {
          console.error('Render mode: audio fetch failed: ' + audioResp.status);
          (window as any).__recorderState = 'error:fetch-failed';
          return;
        }
        const audioBuf = await audioResp.arrayBuffer();
        console.log('Render mode: audio fetched, ' + audioBuf.byteLength + ' bytes');

        // Decode
        const decodedAudio = await actx.decodeAudioData(audioBuf);
        console.log('Render mode: audio decoded, duration=' + decodedAudio.duration + 's channels=' + decodedAudio.numberOfChannels);

        // Set up analyser (reuse engine's analyser if possible for MapScene compatibility)
        const analyserNode = actx.createAnalyser();
        analyserNode.fftSize = 1024;
        analyserNode.smoothingTimeConstant = 0.8;

        // Create buffer source and connect
        const bufferSource = actx.createBufferSource();
        bufferSource.buffer = decodedAudio;
        bufferSource.connect(analyserNode);
        analyserNode.connect(actx.destination);
        bufferSource.start(0);

        // Patch engine's analyser so MapScene.getAudioData() reads from this one
        (engine as any).audioCtx = actx;
        (engine as any).analyser = analyserNode;
        (engine as any).isPlaying = true;
        // Give the analyser a proper data array
        (engine as any).dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        console.log('Render mode: audio playing via BufferSource');

        // Listen for audio end to stop recording
        const songDurationMs = decodedAudio.duration * 1000;
        setTimeout(() => {
          console.log(`Render mode: song would end at ${songDurationMs}ms, waiting for configured duration`);
        }, songDurationMs);

        // Start canvas recording
        console.log('Render mode: starting canvas recording...');

        (window as any).__recorderState = 'setup';

        // Check canvas is in DOM (no getContext call - it can disconnect Three.js)
        if (!document.body.contains(canvas)) {
          console.error('Render mode: canvas not in DOM');
          return;
        }
        console.log('Render mode: canvas in DOM, capturing stream...');

        // captureStream at moderate fps (headless Chrome can't do 25 reliably with SwiftShader)
        const stream = canvas.captureStream(12);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 800000, // 800kbps for decent quality at 12fps
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

          // Convert blob to base64 for puppeteer to read
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

        // BufferSource ended -> stop recording (for full song renders)
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

        // Stop recording after configured duration (takes priority for shorter clips)
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

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
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

  const bgDark = theme !== 'auto'
    ? `#${themes[theme]?.uBaseColor1.getHexString()}`
    : '#0a0a12';

  // Auto-detect device performance
  const perf = getDevicePerformance();

  // User overrides for quality / antialias (null = use auto-detect)
  const effectiveQuality = userQuality || perf.perfLevel;
  const effectiveAntialias = userAntialias !== null ? userAntialias : perf.antialias;

  // dpr/gl by quality level
  const qualityDpr: Record<string, [number, number]> = { low: [0.5, 1], medium: [0.75, 1.5], high: [1, 2] };
  const qualityGrid: Record<string, number> = { low: 50, medium: 80, high: 100 };

  // Render mode: forced quality, normal mode: user override (or auto-detect)
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
        <UI
          theme={theme}
          onThemeChange={setTheme}
          isMobile={isMobile}
          onCoverChange={setCurrentCover}
          uiHidden={uiHidden}
          onUiHiddenChange={setUiHidden}
          userQuality={userQuality}
          onQualityChange={setUserQuality}
          userAntialias={userAntialias}
          onAntialiasChange={setUserAntialias}
        />
      )}
      <div className={renderMode ? 'fixed inset-0' : `absolute inset-0 ${uiHidden ? 'z-[1]' : 'z-0'}`}>
        <Canvas
          camera={{ position: [35, 25, 35], fov: 45 }}
          dpr={canvasDpr}
          performance={canvasPerf}
          gl={canvasGl}
        >
          <MapScene theme={theme} isMobile={isMobile} perfLevel={effectiveQuality} coverUrl={currentCover} isDJMode={isDJMode} />
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
