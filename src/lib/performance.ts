export type PerfLevel = 'low' | 'medium' | 'high';

export interface DevicePerfConfig {
  perfLevel: PerfLevel;
  dpr: [number, number];
  antialias: boolean;
  powerPreference: string;
  gridSize: number;
  maxMeteors: number;
  maxParticles: number;
  frameSkip: number;
}

let cachedConfig: DevicePerfConfig | null = null;

export function getDevicePerformance(isMobile: boolean): DevicePerfConfig {
  if (cachedConfig) return cachedConfig;

  if (typeof window === 'undefined') {
    // SSR fallback
    cachedConfig = {
      perfLevel: 'medium',
      dpr: [1, 1],
      antialias: false,
      powerPreference: 'high-performance',
      gridSize: isMobile ? 80 : 130,
      maxMeteors: isMobile ? 6 : 15,
      maxParticles: isMobile ? 20 : 100,
      frameSkip: isMobile ? 1 : 0,
    };
    return cachedConfig;
  }

  let score = 0;

  // CPU cores
  if (navigator.hardwareConcurrency) {
    if (navigator.hardwareConcurrency >= 8) score += 2;
    else if (navigator.hardwareConcurrency >= 6) score += 1;
    else if (navigator.hardwareConcurrency >= 4) score += 0;
    else score -= 1;
  } else {
    score -= 1;
  }

  // Device memory (Chrome only)
  const dm = (navigator as any).deviceMemory;
  if (dm) {
    if (dm >= 8) score += 2;
    else if (dm >= 4) score += 1;
    else score -= 1;
  } else {
    score -= 1;
  }

  // Mobile penalty
  const isMobileUA = /Mobi|Android|iPhone|iPad|webOS/i.test(navigator.userAgent);
  if (isMobileUA) score -= 1;

  // GPU detection: look for low-end renderers
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const renderer = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        const lowEnd = ['mali', 'adreno 5', 'adreno 6', 'powervr', 'intel hd graphics', 'intel g41', 'mesa llvmpipe'];
        for (const gpu of lowEnd) {
          if (renderer.includes(gpu)) { score -= 1; break; }
        }
      }
    }
  } catch (_) { /* WebGL may be blocked */ }

  // Determine config from score
  if (score >= 3) {
    cachedConfig = {
      perfLevel: 'high',
      dpr: [1, 2],
      antialias: true,
      powerPreference: 'high-performance',
      gridSize: isMobile ? 100 : 160,
      maxMeteors: isMobile ? 8 : 20,
      maxParticles: isMobile ? 40 : 200,
      frameSkip: isMobile ? 1 : 0,
    };
  } else if (score >= 0) {
    cachedConfig = {
      perfLevel: 'medium',
      dpr: [0.75, 1.5],
      antialias: false,
      powerPreference: 'high-performance',
      gridSize: isMobile ? 80 : 130,
      maxMeteors: isMobile ? 5 : 12,
      maxParticles: isMobile ? 15 : 80,
      frameSkip: isMobile ? 1 : 0,
    };
  } else {
    cachedConfig = {
      perfLevel: 'low',
      dpr: [0.5, 1],
      antialias: false,
      powerPreference: 'low-power',
      gridSize: isMobile ? 50 : 90,
      maxMeteors: isMobile ? 3 : 8,
      maxParticles: isMobile ? 8 : 40,
      frameSkip: 2,
    };
  }

  return cachedConfig;
}
