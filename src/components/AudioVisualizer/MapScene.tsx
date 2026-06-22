import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, useMemo, useState, useLayoutEffect, useEffect } from 'react';
import { MapShaderMaterial } from './CustomShaderMaterial';
import { engine } from '../../lib/AudioEngine';
import { themes } from '../../lib/themes';

// Reusable white color for meteor lerp (avoids per-frame allocation)
const _WHITE = new THREE.Color(0xffffff);

// ─── Audio-based theme auto-selection ───────────────────────────────
// Maps real-time audio features to the best-fitting visual theme.
// Each theme has an "ideal" mood vector; we find the closest match.
function computeBestTheme(data: ReturnType<typeof engine.getAudioData>): string {
  const warmth = data.warmth ?? 0.5;
  const brightness = data.brightness ?? 0.5;
  const energy = data.energy ?? 0.5;
  const density = data.density ?? 0.5;
  const centroid = (data.spectralCentroid ?? 256) / 512;

  const currentMood = [warmth, brightness, energy, density, centroid];

  // Theme mood profiles: [warmth, brightness, energy, density, centroid]
  const themeMoods: Record<string, number[]> = {
    'nocturnal':          [0.70, 0.20, 0.25, 0.30, 0.30], // warm, calm, atmospheric
    'neon-tokyo':         [0.20, 0.80, 0.75, 0.70, 0.70], // cool, bright, energetic
    'cyber-forest':       [0.50, 0.50, 0.50, 0.50, 0.50], // balanced, organic
    'minimal-monochrome': [0.20, 0.30, 0.15, 0.20, 0.35], // cool, sparse, minimal
    'dj-club':            [0.15, 0.90, 0.90, 0.85, 0.80], // cool-bright, max energy, dense, bright centroid
  };

  const weights = [0.30, 0.25, 0.20, 0.15, 0.10]; // feature importance

  let bestId = 'nocturnal';
  let bestScore = -Infinity;

  for (const [id, ideal] of Object.entries(themeMoods)) {
    let score = 0;
    for (let i = 0; i < 5; i++) {
      score += (1 - Math.abs(ideal[i] - currentMood[i])) * weights[i];
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}

// ─── Dynamic scene parameters from audio ────────────────────────────
function getSceneParams(data: ReturnType<typeof engine.getAudioData>) {
  const energy = Math.min(1, data.energy * 1.2);
  const brightness = data.brightness ?? 0.5;
  const sharpness = data.sharpness ?? 0.5;

  return {
    autoRotateSpeed: 0.10 + energy * 0.65,          // 0.10–0.75
    meteorCooldown: Math.round(300 - sharpness * 200), // 100–300 frames
    glowBoost: 0.80 + brightness * 0.70,             // 0.80–1.50
  };
}

// ─── React Component ────────────────────────────────────────────────
type PerfLevel = 'low' | 'medium' | 'high';

function getPerfValue<T>(perfLevel: PerfLevel, values: [T, T, T]): T {
  const idx = perfLevel === 'low' ? 0 : perfLevel === 'medium' ? 1 : 2;
  return values[idx];
}

export function MapScene({
  theme = 'auto',
  isMobile = false,
  perfLevel = 'medium',
  isDJMode = false,
}: {
  theme?: string;
  isMobile?: boolean;
  perfLevel?: PerfLevel;
  isDJMode?: boolean;
}) {
  const controlsRef = useRef<OrbitControls>(null!);
  // Timer replaces deprecated THREE.Clock
  const timer = useMemo(() => new THREE.Timer(), []);
  const timeRef = useRef(0);

  const gridSize = getPerfValue(perfLevel, [50, 80, 100]);
  const spacing = isMobile ? 1.1 : 1.05;

  // ── Grid chunking for per-chunk frustum culling ──────────
  const CHUNK_SIZE = isMobile ? 24 : 16;
  const numChunksX = Math.ceil(gridSize / CHUNK_SIZE);
  const numChunksZ = Math.ceil(gridSize / CHUNK_SIZE);
  const totalChunks = numChunksX * numChunksZ;
  const gridChunks = useMemo(() => {
    const chunks: { sx: number; sz: number; w: number; h: number; count: number }[] = [];
    for (let cx = 0; cx < numChunksX; cx++) {
      for (let cz = 0; cz < numChunksZ; cz++) {
        const w = Math.min(CHUNK_SIZE, gridSize - cx * CHUNK_SIZE);
        const h = Math.min(CHUNK_SIZE, gridSize - cz * CHUNK_SIZE);
        chunks.push({ sx: cx * CHUNK_SIZE, sz: cz * CHUNK_SIZE, w, h, count: w * h });
      }
    }
    return chunks;
  }, [gridSize]);

  // Shared geometry & material for all grid chunks
  const boxGeo = useMemo(() => new THREE.BoxGeometry(isMobile ? 0.85 : 0.9, 1, isMobile ? 0.85 : 0.9), [isMobile]);
  const sharedMat = useMemo(() => { const m = new MapShaderMaterial(); m.transparent = true; return m; }, []);

  // Refs for each chunk — initialize to correct array length
  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  if (meshRefs.current.length !== totalChunks) {
    meshRefs.current = new Array(totalChunks).fill(null);
  }

  useLayoutEffect(() => {
    const tempMatrix = new THREE.Matrix4();
    const offset = (gridSize * spacing) / 2;

    gridChunks.forEach((chunk, idx) => {
      const mesh = meshRefs.current[idx];
      if (!mesh) return;

      let i = 0;
      for (let x = chunk.sx; x < chunk.sx + chunk.w; x++) {
        for (let z = chunk.sz; z < chunk.sz + chunk.h; z++) {
          const px = x * spacing - offset;
          const pz = z * spacing - offset;
          tempMatrix.makeTranslation(px, 0.5, pz);
          mesh.setMatrixAt(i, tempMatrix);
          i++;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;

      // Per-chunk bounding sphere for accurate frustum culling
      const centerX = (chunk.sx + chunk.w / 2) * spacing - offset;
      const centerZ = (chunk.sz + chunk.h / 2) * spacing - offset;
      const radius = Math.sqrt((chunk.w * spacing / 2) ** 2 + (chunk.h * spacing / 2) ** 2);
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(centerX, 0.5, centerZ), radius * 1.5);
    });
  }, [gridChunks, spacing]);

  // ── Auto-theme state (only used when theme === 'auto') ──────────
  const autoThemeRef = useRef('nocturnal');

  // ── Ripples logic ──────────────────────────────────────────────
  const MAX_RIPPLES = getPerfValue(perfLevel, [3, 6, 10]);
  const ripplesRef = useRef(new Array(MAX_RIPPLES).fill(null).map(() => ({
    pos: new THREE.Vector2(),
    time: -100,
    strength: 0,
    isActive: 0,
    rippleType: 0,
  })));
  const rippleIndex = useRef(0);
  const ripplesDirty = useRef(false);
  const paddedRipplesRef = useRef(new Array(10).fill(null).map(() => ({
    pos: new THREE.Vector2(),
    time: -100,
    strength: 0,
    isActive: 0,
    rippleType: 0,
  })));

  const addRipple = (x: number, y: number, strength: number, isWhite = false) => {
    const idx = rippleIndex.current;
    const slot = ripplesRef.current[idx];
    slot.pos.set(x, y);
    slot.time = timeRef.current;
    slot.strength = strength;
    slot.isActive = 1;
    slot.rippleType = isWhite ? 1 : 0;
    rippleIndex.current = (idx + 1) % MAX_RIPPLES;
    ripplesDirty.current = true;
  };

  const fogRef = useRef<THREE.Fog>(null);

  // ── Frame skipping on mobile ───────────────────────────────────
  const frameCount = useRef(0);
  const FRAME_SKIP = getPerfValue(perfLevel, [2, 1, 0]);

  // ── Meteors ────────────────────────────────────────────────────
  const MAX_METEORS = getPerfValue(perfLevel, [3, 5, 8]);
  const meteorMeshRef = useRef<THREE.InstancedMesh>(null);
  const meteorMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const meteorTargetColorRef = useRef(new THREE.Color(0xffffff));

  const MAX_PARTICLES = getPerfValue(perfLevel, [8, 15, 40]);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const particlesRef = useRef(new Array(MAX_PARTICLES).fill(null).map(() => ({
    active: false,
    x: 0, y: -1000, z: 0,
    vx: 0, vy: 0, vz: 0,
    life: 0, maxLife: 1, scale: 1,
  })));
  const particleIndex = useRef(0);

  const spawnParticle = (x: number, y: number, z: number, speedM: number) => {
    const idx = particleIndex.current;
    const p = particlesRef.current[idx];
    p.active = true;
    p.x = x + (Math.random() - 0.5) * 1.5;
    p.y = y + (Math.random() - 0.5) * 1.5;
    p.z = z + (Math.random() - 0.5) * 1.5;
    p.vx = (Math.random() - 0.5) * 2.0;
    p.vy = Math.random() * 2.0 + speedM * 10.0;
    p.vz = (Math.random() - 0.5) * 2.0;
    p.life = 0;
    p.maxLife = 0.5 + Math.random() * 0.5;
    p.scale = Math.random() * 0.6 + 0.2;
    particleIndex.current = (idx + 1) % MAX_PARTICLES;
  };

  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyPosition = useMemo(() => new THREE.Vector3(), []);
  const dummyRotation = useMemo(() => new THREE.Quaternion(), []);
  const dummyScale = useMemo(() => new THREE.Vector3(), []);

  const meteorsRef = useRef(new Array(MAX_METEORS).fill(null).map(() => ({
    active: false,
    x: 0, y: -1000, z: 0,
    speed: 0, strength: 0,
  })));
  const meteorIndex = useRef(0);
  const lastMeteorSpawnTime = useRef(-Infinity);

  const addMeteor = (strength: number) => {
    const now = timeRef.current;
    const cooldownSeconds = engine.meteorTrigger.cooldown / 60;
    if (now - lastMeteorSpawnTime.current < cooldownSeconds) return;
    lastMeteorSpawnTime.current = now;

    const idx = meteorIndex.current;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (isMobile ? 15 : 25);

    const m = meteorsRef.current[idx];
    m.active = true;
    m.x = Math.cos(angle) * dist;
    m.z = Math.sin(angle) * dist;
    m.y = 30 + Math.random() * 10;
    m.speed = 1.0 + Math.random() * 0.5 + strength * 1.5;
    m.strength = strength;
    meteorIndex.current = (idx + 1) % MAX_METEORS;
  };

  // ── Beat detection wiring ──────────────────────────────────────
  useEffect(() => {
    engine.onFreqTrigger = (strength, mode, action) => {
      if (action === 'Meteor') {
        addMeteor(strength);
      } else {
        const angle = Math.random() * Math.PI * 2;
        if (mode === 'Kick') {
          const dist = Math.random() * (isMobile ? 15 : 25);
          addRipple(Math.cos(angle) * dist, Math.sin(angle) * dist, Math.min(strength * 3.0, 4.0));
        } else {
          const dist = (isMobile ? 5 : 10) + Math.random() * (isMobile ? 15 : 25);
          addRipple(Math.cos(angle) * dist, Math.sin(angle) * dist, Math.min(strength * 3.0, 3.0));
        }
      }
    };
  }, [theme, isMobile]);

  // ── Main render loop ───────────────────────────────────────────
  useFrame((state, delta) => {
    if (!sharedMat) return;

    if (FRAME_SKIP > 0) {
      frameCount.current++;
      if (frameCount.current < FRAME_SKIP) return;
      frameCount.current = 0;
    }

    const mat = sharedMat;
    const data = engine.getAudioData();

    // ── Resolve theme ──────────────────────────────────────────
    const manualOverride = theme !== 'auto';
    if (!manualOverride) {
      autoThemeRef.current = computeBestTheme(data);
    }
    const activeTheme = manualOverride ? theme : autoThemeRef.current;
    const t = themes[activeTheme] || themes['nocturnal'];

    // ── Dynamic scene parameters ────────────────────────────────
    const params = getSceneParams(data);
    // DJ mode: override with club-optimized values
    if (isDJMode) {
      params.autoRotateSpeed = Math.max(params.autoRotateSpeed, 0.35);
      params.meteorCooldown = Math.min(params.meteorCooldown, 150);
      params.glowBoost = Math.max(params.glowBoost, 1.3);
    }

    // Update engine meteor trigger cooldown (dynamic)
    engine.meteorTrigger.cooldown = params.meteorCooldown;

    // Update OrbitControls rotation speed (dynamic)
    if (controlsRef.current) {
      controlsRef.current.autoRotateSpeed = params.autoRotateSpeed;
    }

    // ── Smooth theme colour transition ─────────────────────────
    const lerpSpeed = 3.0 * delta;

    // Glow = theme baseline × audio boost
    const targetGlow = t.uGlowIntensity * params.glowBoost;

    mat.uBaseColor1.lerp(t.uBaseColor1, lerpSpeed);
    mat.uBaseColor2.lerp(t.uBaseColor2, lerpSpeed);
    mat.uCoolCore.lerp(t.uCoolCore, lerpSpeed);
    mat.uCoolEdge.lerp(t.uCoolEdge, lerpSpeed);
    mat.uWarmCore.lerp(t.uWarmCore, lerpSpeed);
    mat.uWarmEdge.lerp(t.uWarmEdge, lerpSpeed);
    mat.uRippleColor.lerp(t.uRippleColor, lerpSpeed);
    mat.uGlowIntensity = THREE.MathUtils.lerp(mat.uGlowIntensity, targetGlow, lerpSpeed);

    // Skip fog color transition on mobile (saves lerp per frame, barely noticeable)
    if (fogRef.current && !isMobile) {
      fogRef.current.color.lerp(t.uBaseColor1, lerpSpeed);
    }
    timer.update();
    mat.uTime = timer.getElapsed();
    timeRef.current = timer.getElapsed();
    mat.uBass = data.bass;
    mat.uMid = data.mid;
    mat.uTreble = data.treble;
    mat.uEnergy = data.energy;

    if (!isMobile) {
      mat.uSubBass = data.subBass;
      mat.uLowMid = data.lowMid;
      mat.uHighMid = data.highMid;
      mat.uPresence = data.presence;
      mat.uBrilliance = data.brilliance;
      mat.uAir = data.air;
      mat.uWarmth = data.warmth;
      mat.uBrightness = data.brightness;
      mat.uSharpness = data.sharpness;
      mat.uSmoothness = data.smoothness;
      mat.uDensity = data.density;
      mat.uSpectralCentroid = data.spectralCentroid;
    }

    // ── Ripples ────────────────────────────────────────────────
    if (ripplesDirty.current) {
      const padded = paddedRipplesRef.current;
      const active = ripplesRef.current;
      for (let i = 0; i < 10; i++) {
        const src = i < active.length ? active[i] : padded[i];
        padded[i].pos.set(src.pos.x, src.pos.y);
        padded[i].time = src.time;
        padded[i].strength = src.strength;
        padded[i].isActive = src.isActive;
        padded[i].rippleType = src.rippleType;
      }
      mat.uRipples = padded;
      ripplesDirty.current = false;
    }

    // ── Meteors ────────────────────────────────────────────────
    if (meteorMeshRef.current) {
      if (meteorMatRef.current) {
        meteorTargetColorRef.current.copy(t.uWarmCore).lerp(_WHITE, 0.7);
        meteorMatRef.current.color.lerp(meteorTargetColorRef.current, lerpSpeed);
      }

      for (let i = 0; i < MAX_METEORS; i++) {
        const m = meteorsRef.current[i];
        if (!m.active) {
          dummyPosition.set(0, -1000, 0);
          dummyScale.set(0, 0, 0);
          dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
          meteorMeshRef.current.setMatrixAt(i, dummyMatrix);
        } else {
          // ── Frustum culling: hide if behind camera or too far ──
          const mpx = m.x;
          const mpz = m.z;
          const camPos = state.camera.position;
          const dx = mpx - camPos.x;
          const dz = mpz - camPos.z;
          const distToCam = Math.sqrt(dx * dx + dz * dz);
          
          if (distToCam > 90 || (m.y > 5 && dx * state.camera.matrixWorld.elements[8] + dz * state.camera.matrixWorld.elements[10] > 5)) {
            dummyPosition.set(mpx, m.y, mpz);
            dummyScale.set(0, 0, 0);
            dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
            meteorMeshRef.current.setMatrixAt(i, dummyMatrix);
            m.y -= m.speed * 60 * delta;
            if (m.y <= 0) {
              m.active = false;
              addRipple(m.x, m.z, Math.min(m.strength * 1.0, 1.2), true);
              const particleCount = isMobile ? 3 : 10;
              for (let pIndex = 0; pIndex < particleCount; pIndex++) spawnParticle(m.x, 0.5, m.z, m.speed * 1.5);
            }
            continue;
          }
          
          m.y -= m.speed * 60 * delta;
          if (m.y <= 0) {
            m.active = false;
            addRipple(m.x, m.z, Math.min(m.strength * 1.0, 1.2), true);
            const particleCount = isMobile ? 3 : 10;
            for (let pIndex = 0; pIndex < particleCount; pIndex++) spawnParticle(m.x, 0.5, m.z, m.speed * 1.5);
          }
          dummyPosition.set(m.x, Math.max(0, m.y), m.z);
          dummyScale.set(1.5, 1.5, 1.5);
          dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
          meteorMeshRef.current.setMatrixAt(i, dummyMatrix);

          if (m.y > 0 && Math.random() > (isMobile ? 0.5 : 0.3)) {
            spawnParticle(m.x, m.y, m.z, m.speed * 0.2);
          }
        }
      }
      meteorMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── Particles ───────────────────────────────────────────────
    if (particleMeshRef.current) {
      if (particleMatRef.current) {
        particleMatRef.current.color.copy(
          meteorMatRef.current ? meteorMatRef.current.color : new THREE.Color(0xffffff)
        );
      }

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particlesRef.current[i];
        if (!p.active) {
          dummyPosition.set(0, -1000, 0);
          dummyScale.set(0, 0, 0);
          dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
          particleMeshRef.current.setMatrixAt(i, dummyMatrix);
        } else {
          p.life += delta;
          if (p.life >= p.maxLife) {
            p.active = false;
            dummyScale.set(0, 0, 0);
          } else {
            p.x += p.vx * delta * 10;
            p.y += p.vy * delta * 10;
            p.z += p.vz * delta * 10;
            const s = p.scale * (1.0 - p.life / p.maxLife);
            dummyPosition.set(p.x, p.y, p.z);
            if (dummyPosition.distanceTo(state.camera.position) > 70) { dummyScale.set(0, 0, 0); }
            else { dummyScale.set(s, s, s); }
          }
          dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
          particleMeshRef.current.setMatrixAt(i, dummyMatrix);
        }
      }
      particleMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // ── Interaction ──────────────────────────────────────────────────
  const [pressTime, setPressTime] = useState(0);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    setPressTime(performance.now());
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const duration = performance.now() - pressTime;
    const strength = Math.min(0.2 + (duration / 1000) * 2.8, 3.0);
    addRipple(e.point.x, e.point.z, strength);
  };

  // ── JSX ──────────────────────────────────────────────────────────
  // For initial render just use 'nocturnal'; the useFrame will adjust immediately
  const initialThemeKey = theme !== 'auto' ? theme : 'nocturnal';
  const initialT = themes[initialThemeKey] || themes['nocturnal'];

  return (
    <>
      <fog
        ref={fogRef}
        attach="fog"
        args={[`#${initialT.uBaseColor1.getHexString()}`, isMobile ? 20 : 30, isMobile ? 55 : 95]}
      />
      <ambientLight intensity={isMobile ? 0.3 : 0.5} />
      <directionalLight position={[10, 20, 10]} intensity={isMobile ? 0.6 : 1} />

      {/*
        Culling strategy:
        - Grid: Split into 16x16-column chunks, each with own InstancedMesh +
          frustumCulled={true} + tight bounding sphere. Three.js culls entire
          chunks outside the view frustum — draw calls drop ~75% when zoomed in.
        - Meteors: Per-instance frustum+distance check. Behind-camera or >90u hidden.
        - Particles: Distance-based check. >70u from camera hidden (scale=0).
      */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        autoRotate={!isMobile}
        autoRotateSpeed={isMobile ? 0.3 : 0.5}
        enablePan={false}
        minDistance={isMobile ? 10 : 5}
        maxDistance={isMobile ? 80 : 120}
        maxPolarAngle={Math.PI / 2 - 0.1}
        enableDamping={!isMobile}
        rotateSpeed={isMobile ? 0.5 : 1.0}
      />

      {gridChunks.map((chunk, idx) => (
        <instancedMesh
          key={idx}
          ref={(el) => { meshRefs.current[idx] = el; }}
          args={[boxGeo, sharedMat, chunk.count]}
          frustumCulled={true}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        />
      ))}

      <instancedMesh ref={meteorMeshRef} args={[undefined as any, undefined as any, MAX_METEORS]} frustumCulled={false}>
        <boxGeometry args={[0.4, 1.2, 0.4]} />
        <meshBasicMaterial ref={meteorMatRef} color="#ffffff" toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={particleMeshRef} args={[undefined as any, undefined as any, MAX_PARTICLES]} frustumCulled={false}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshBasicMaterial ref={particleMatRef} color="#ffffff" toneMapped={false} transparent opacity={0.6} />
      </instancedMesh>
    </>
  );
}
