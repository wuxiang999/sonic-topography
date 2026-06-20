import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI/UI';
import { MapScene } from './components/AudioVisualizer/MapScene';
import { useState, useEffect, useRef, useCallback } from 'react';
import { themes } from './lib/themes';
import { engine } from './lib/AudioEngine';
import { parseLRC } from './lib/lyrics';
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
  // Read render duration from URL or default to 30s
  const renderDuration = useRef(
    typeof window !== 'undefined'
      ? Number(new URLSearchParams(window.location.search).get('dur')) || 30
      : 30
  );

  // ===== Local Recording State =====
  const [isRecording, setIsRecording] = useState(false);
  const recordingLyricsRef = useRef<string>('');
  const recordingLrcLinesRef = useRef<{ time: number; text: string }[]>([]);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const localRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingRafRef = useRef<number>(0);
  const recordingStartTimeRef = useRef(0);

  const startLocalRecording = useCallback((lyricsLrc: string) => {
    const threeCanvas = document.querySelector('canvas');
    if (!threeCanvas) { console.error('No canvas found'); return; }
    
    // Parse lyrics for styled rendering
    recordingLyricsRef.current = lyricsLrc;
    recordingLrcLinesRef.current = parseLRC(lyricsLrc);
    
    setIsRecording(true);
    recordingChunksRef.current = [];

    // Create composite canvas in next tick after state update
    requestAnimationFrame(() => {
      const composite = compositeCanvasRef.current;
      if (!composite) return;
      
      // Record at viewport size (scaled down for performance)
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const targetW = Math.min(vw, 1280);
      const targetH = Math.min(vh, 720);
      composite.width = targetW;
      composite.height = targetH;
      const ctx = composite.getContext('2d');
      if (!ctx) return;
      
      // Scale from viewport to composite coordinates
      const sx = targetW / vw;
      const sy = targetH / vh;

      // Set up MediaRecorder on composite canvas
      const stream = composite.captureStream(20);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1500000 });
      localRecorderRef.current = rec;
      
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      
      const finishRecording = () => {
        cancelAnimationFrame(recordingRafRef.current);
        setIsRecording(false);
        
        if (recordingChunksRef.current.length === 0) return;
        const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `视觉渲染-${timestamp}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      rec.onstop = finishRecording;
      rec.start(2000);
      recordingStartTimeRef.current = Date.now();

      // Auto-stop when song ends
      const onAudioEnded = () => {
        if (localRecorderRef.current?.state === 'recording') {
          setTimeout(() => localRecorderRef.current?.stop(), 1500);
        }
      };
      if (engine.audioElement) {
        engine.audioElement.addEventListener('ended', onAudioEnded, { once: true });
      }

      // Get accent color from CSS variable
      const getAccent = (): string => {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        return v || '#00ffff';
      };

      // State for smooth lyrics scroll
      let currentScrollY = 0;

      // Pre-computed constants
      const lyricLeft = targetW * 0.06;
      const lyricWidth = targetW * 0.55;
      const lyricAreaTop = targetH * 0.2;
      const lyricAreaHeight = targetH * 0.55;

      const drawFrame = () => {
        if (!ctx || !composite) return;
        
        // 1. Draw Three.js canvas (3D visualization)
        ctx.drawImage(threeCanvas, 0, 0, composite.width, composite.height);
        
        // 2. Render styled lyrics (matching LyricsDisplay CSS)
        const lines = recordingLrcLinesRef.current;
        const currentTime = engine.audioElement?.currentTime ?? 0;
        
        if (lines.length > 0) {
          // Find active line index (with lookahead tolerance)
          let activeIndex = -1;
          for (let i = 0; i < lines.length; i++) {
            if (currentTime >= lines[i].time - 0.15) activeIndex = i;
            else break;
          }
          
          // Line height and font sizes
          const totalVisible = Math.min(lines.length, 14);
          const lineHeight = lyricAreaHeight / Math.max(totalVisible, 8);
          const activeFontSize = Math.floor(lineHeight * 0.55);
          const inactiveFontSize = Math.floor(lineHeight * 0.38);
          
          // Target: center active line in the lyrics area
          const centerY = lyricAreaTop + lyricAreaHeight / 2;
          let targetY = centerY - (activeIndex + 0.5) * lineHeight;
          if (activeIndex < 0) targetY = centerY;
          
          // Smooth lerp (0.12 at 20fps ≈ 500ms convergence)
          currentScrollY += (targetY - currentScrollY) * 0.12;
          
          // Cache accent color
          const accentColor = getAccent();
          const textX = lyricLeft + 24;

          // Pre-draw vertical timeline (once)
          ctx.strokeStyle = `rgba(255,255,255,0.06)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lyricLeft + 6, lyricAreaTop);
          ctx.lineTo(lyricLeft + 6, lyricAreaTop + lyricAreaHeight);
          ctx.stroke();

          // Draw each visible line
          const startLine = Math.max(0, activeIndex - 7);
          const endLine = Math.min(lines.length, startLine + 16);
          
          for (let i = startLine; i < endLine; i++) {
            const line = lines[i];
            if (!line?.text) continue;
            const isActive = i === activeIndex;
            
            // Y position with smooth scroll
            const yOffset = currentScrollY + i * lineHeight;
            const dotMidY = yOffset + lineHeight / 2;
            
            // Skip if far outside visible area
            if (yOffset < lyricAreaTop - lineHeight || yOffset > lyricAreaTop + lyricAreaHeight + lineHeight) continue;
            
            // Edge fade opacity
            const distFromCenter = Math.abs(dotMidY - centerY);
            const maxDist = lyricAreaHeight / 2;
            const fade = Math.max(0, 1 - (distFromCenter / maxDist) * 1.1);
            const finalAlpha = Math.pow(fade, 0.7);
            
            // 2a. Dot indicator
            if (isActive) {
              // Active line: colored glow circle
              ctx.beginPath();
              ctx.arc(lyricLeft + 6, dotMidY, 6 * finalAlpha, 0, Math.PI * 2);
              ctx.fillStyle = accentColor;
              ctx.shadowColor = `${accentColor}88`;
              ctx.shadowBlur = 12 * finalAlpha;
              ctx.fill();
              ctx.beginPath();
              ctx.arc(lyricLeft + 6, dotMidY, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = '#000';
              ctx.shadowBlur = 0;
              ctx.fill();
            } else {
              // Past/future dot
              const dotR = i < activeIndex ? 3 : 2;
              ctx.beginPath();
              ctx.arc(lyricLeft + 6, dotMidY, dotR * finalAlpha, 0, Math.PI * 2);
              ctx.fillStyle = i < activeIndex
                ? `rgba(0,255,255,${0.5 * finalAlpha})`
                : `rgba(255,255,255,${0.15 * finalAlpha})`;
              ctx.fill();
            }
            
            // 2b. Text line
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            if (isActive) {
              ctx.font = `bold ${activeFontSize}px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`;
              ctx.fillStyle = `rgba(255,255,255,${finalAlpha})`;
              ctx.shadowColor = 'rgba(0,0,0,0.6)';
              ctx.shadowBlur = 8;
              ctx.fillText(line.text, textX, dotMidY + 1);
              ctx.shadowBlur = 0;
            } else if (i < activeIndex) {
              ctx.font = `${inactiveFontSize}px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`;
              ctx.fillStyle = `rgba(255,255,255,${0.2 * finalAlpha})`;
              ctx.fillText(line.text, textX, dotMidY);
            } else {
              ctx.font = `${inactiveFontSize}px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`;
              ctx.fillStyle = `rgba(255,255,255,${0.35 * finalAlpha})`;
              ctx.fillText(line.text, textX, dotMidY);
            }
          }
        }
        
        // 3. REC indicator (top right)
        ctx.shadowBlur = 0;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ff3333';
        ctx.fillText('● REC', composite.width - 12, 12);
        
        // Elapsed time
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px monospace';
        ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, composite.width - 12, 30);
        
        recordingRafRef.current = requestAnimationFrame(drawFrame);
      };
      
      recordingRafRef.current = requestAnimationFrame(drawFrame);
    });
  }, []);

  const stopLocalRecording = useCallback(() => {
    if (localRecorderRef.current?.state === 'recording') {
      localRecorderRef.current.stop();
    }
    cancelAnimationFrame(recordingRafRef.current);
    setIsRecording(false);
  }, []);

  // Expose render mode to window for puppeteer
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

  // Render mode: forced quality, normal mode: auto-detect
  const canvasDpr = renderMode ? [1, 1] : perf.dpr;
  const canvasPerf = renderMode ? { min: 1 } : { min: 0.3 };
  const canvasGl = renderMode
    ? { antialias: true, alpha: false, powerPreference: 'high-performance' as const, preserveDrawingBuffer: true }
    : { antialias: perf.antialias, alpha: false, powerPreference: perf.powerPreference as WebGLPowerPreference, preserveDrawingBuffer: true };

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
          isRecording={isRecording}
          onStartRecording={startLocalRecording}
          onStopRecording={stopLocalRecording}
          onCoverChange={setCurrentCover}
        />
      )}
      <div className={renderMode ? 'fixed inset-0' : 'absolute inset-0 z-0'}>
        <Canvas
          camera={{ position: [35, 25, 35], fov: 45 }}
          dpr={canvasDpr}
          performance={canvasPerf}
          gl={canvasGl}
        >
          <MapScene theme={theme} isMobile={isMobile} perfLevel={perf.perfLevel} coverUrl={currentCover} />
        </Canvas>
      </div>
      {renderMode && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            color: 'rgba(255,50,50,0.6)',
            fontSize: 13,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          ● REC
        </div>
      )}

      {/* Local Recording overlay composite canvas */}
      {isRecording && (
        <canvas
          ref={compositeCanvasRef}
          className="fixed inset-0 z-[60] pointer-events-none"
          style={{ width: '100vw', height: '100vh' }}
        />
      )}
    </div>
  );
}
