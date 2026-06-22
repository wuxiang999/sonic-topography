import { useRef, useEffect, useCallback } from 'react';
import { engine } from '../../lib/AudioEngine';

interface VisualizerOverlayProps {
  accentHex?: string;
  isPlaying?: boolean;
  isCapturing?: boolean;
  barCount?: number;
}

const DEFAULT_BAR_COUNT = 64;
const SMOOTHING = 0.15;
const COLOR_SMOOTHING = 0.04; // smooth color transitions per frame
const CANVAS_HEIGHT = 120;

export function VisualizerOverlay({
  accentHex = '#00ffff',
  isPlaying = false,
  isCapturing = false,
  barCount = DEFAULT_BAR_COUNT,
}: VisualizerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const barsRef = useRef(new Float32Array(128).fill(0));
  const displayColorRef = useRef({ r: 0, g: 255, b: 255 });

  // Parse target accent hex to RGB
  let targetR = 0, targetG = 255, targetB = 255;
  if (accentHex.startsWith('#')) {
    const hex = accentHex.slice(1);
    if (hex.length === 6) {
      targetR = parseInt(hex.slice(0, 2), 16);
      targetG = parseInt(hex.slice(2, 4), 16);
      targetB = parseInt(hex.slice(4, 6), 16);
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    // Smoothly interpolate display color toward target
    const dc = displayColorRef.current;
    dc.r += (targetR - dc.r) * COLOR_SMOOTHING;
    dc.g += (targetG - dc.g) * COLOR_SMOOTHING;
    dc.b += (targetB - dc.b) * COLOR_SMOOTHING;
    const r = Math.round(dc.r);
    const g = Math.round(dc.g);
    const b = Math.round(dc.b);

    // Get audio data
    const data = engine.getAudioData();
    const raw = engine.getRawFrequencyData();
    const energy = data.energy || 0;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw dark backdrop so the area is visible
    ctx.fillStyle = 'rgba(5,10,15,0.55)';
    ctx.fillRect(0, 0, w, h);

    // Draw frequency bars
    if (raw.length > 0) {
      const bc = Math.min(Math.max(barCount, 8), 128); // clamp 8-128
      const now = Date.now() * 0.001;
      // Breathing wave constants (used both for idle and active modulation)
      const breatheSlow = Math.sin(now * 0.8) * 0.5 + 0.5; // 0-1 slow wave
      const breatheMed = Math.sin(now * 1.2) * 0.3 + 0.7;  // 0.4-1 medium wave

      if (isPlaying && raw.length > 0) {
        const binStep = Math.floor(raw.length / bc);
        const barWidth = (w / bc) * 0.6;
        const gap = (w / bc) * 0.4;
        const maxBarHeight = h * 0.78;
        // Subtle breathing modulation on active bars (0.85-1.15 amplitude)
        const breatheMod = 0.85 + breatheSlow * 0.3;

        for (let i = 0; i < bc; i++) {
          let val = 0;
          for (let j = 0; j < binStep; j++) {
            val += raw[i * binStep + j] || 0;
          }
          val = val / binStep / 255;

          // Smooth bar heights
          barsRef.current[i] += (val - barsRef.current[i]) * SMOOTHING;

          // Apply breathing modulation on top of audio data
          const displayVal = barsRef.current[i] * breatheMod;
          const barHeight = Math.max(0.5, displayVal * maxBarHeight);
          const x = i * (barWidth + gap) + gap * 0.5;
          const y = h - barHeight;

          const alpha = 0.2 + displayVal * 0.6;
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(x, y, barWidth, barHeight);
        }

        // Bottom accent glow line (with breathing)
        const glowAlpha = 0.08 + energy * 0.15 + breatheSlow * 0.04;
        ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha})`;
        ctx.fillRect(0, h - 1, w, 1);
      } else {
        // Self-breathing animation when idle
        const barWidth = (w / bc) * 0.6;
        const gap = (w / bc) * 0.4;
        const maxBarHeight = h * 0.78;
        const breatheScale = 0.15 + breatheSlow * 0.35; // 0.15-0.50 breathing amplitude

        // Smooth bars toward breathing values
        for (let i = 0; i < bc; i++) {
          // Each bar has its own phase for a wave effect
          const phase = i / bc * Math.PI * 3;
          const targetVal = breatheScale * (0.5 + 0.5 * Math.sin(phase + now * 0.6 + breatheMed * 0.5));
          barsRef.current[i] += (targetVal - barsRef.current[i]) * SMOOTHING;

          const displayVal = barsRef.current[i];
          const barHeight = Math.max(0.5, displayVal * maxBarHeight);
          const x = i * (barWidth + gap) + gap * 0.5;
          const y = h - barHeight;

          const alpha = 0.1 + displayVal * 0.4;
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(x, y, barWidth, barHeight);
        }

        // Gentle breathing glow line
        const glowAlpha = 0.03 + breatheSlow * 0.06;
        ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha})`;
        ctx.fillRect(0, h - 1, w, 1);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [accentHex, isPlaying, barCount]);

  // Resize + animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
    };

    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // Restart loop when isCapturing changes
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isCapturing, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-x-0 bottom-0 z-[5] pointer-events-none"
      style={{ height: `${CANVAS_HEIGHT}px`, width: '100%' }}
    />
  );
}
