import { readStorage, writeStorage } from './storage';

export const GROUND_EQ_STORAGE_KEY = 'sonic-topography-ground-eq-v1';
export const GROUND_EQ_POINT_COUNT = 16;
export const DEFAULT_GROUND_EQ_VALUE = 50;

export interface StoredGroundEqSettings {
  curve: number[];
}

export const defaultGroundEqCurve = new Array(GROUND_EQ_POINT_COUNT).fill(DEFAULT_GROUND_EQ_VALUE);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeGroundEqSettings(value: Partial<StoredGroundEqSettings> | null | undefined): StoredGroundEqSettings {
  const source = Array.isArray(value?.curve) ? value.curve : defaultGroundEqCurve;
  const curve = Array.from({ length: GROUND_EQ_POINT_COUNT }, (_, index) => {
    const numeric = Number(source[index]);
    return Number.isFinite(numeric) ? clamp(Math.round(numeric), 0, 100) : DEFAULT_GROUND_EQ_VALUE;
  });

  return { curve };
}

export function readGroundEqSettingsStorage(): StoredGroundEqSettings {
  return readStorage<StoredGroundEqSettings>(
    GROUND_EQ_STORAGE_KEY,
    { curve: defaultGroundEqCurve },
    normalizeGroundEqSettings,
  );
}

export function writeGroundEqSettingsStorage(settings: StoredGroundEqSettings) {
  writeStorage(GROUND_EQ_STORAGE_KEY, normalizeGroundEqSettings(settings));
}

export function readGroundEqCurveValue(curve: number[], unit: number) {
  const normalized = normalizeGroundEqSettings({ curve }).curve;
  const safeUnit = clamp(unit, 0, 1);
  const scaled = safeUnit * (GROUND_EQ_POINT_COUNT - 1);
  const leftIndex = Math.floor(scaled);
  const rightIndex = Math.min(GROUND_EQ_POINT_COUNT - 1, leftIndex + 1);
  const mix = scaled - leftIndex;
  return normalized[leftIndex] * (1 - mix) + normalized[rightIndex] * mix;
}

export const EQ_PRESETS: Record<string, { name: string; curve: number[] }> = {
  flat: {
    name: '平坦',
    curve: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
  },
  rock: {
    name: '摇滚',
    curve: [70, 65, 60, 55, 50, 45, 40, 35, 35, 40, 45, 50, 55, 60, 65, 70],
  },
  electronic: {
    name: '电子',
    curve: [80, 70, 60, 50, 40, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90],
  },
  classical: {
    name: '古典',
    curve: [35, 40, 45, 50, 55, 60, 65, 70, 70, 65, 60, 55, 50, 45, 40, 35],
  },
  vocal: {
    name: '人声',
    curve: [30, 35, 40, 50, 60, 70, 75, 75, 70, 65, 60, 50, 45, 40, 35, 30],
  },
  bassBoost: {
    name: '低音增强',
    curve: [90, 85, 80, 75, 65, 55, 45, 35, 30, 30, 35, 40, 45, 50, 50, 50],
  },
  trebleBoost: {
    name: '高音增强',
    curve: [50, 50, 50, 45, 40, 35, 30, 30, 35, 45, 55, 65, 75, 80, 85, 90],
  },
};

export const EQ_PRESET_IDS = Object.keys(EQ_PRESETS);

export function getEqPresetCurve(presetId: string): number[] | null {
  return EQ_PRESETS[presetId]?.curve ?? null;
}

export function applyGroundEqValue(value: number, curve: number[], unit: number) {
  const eq = readGroundEqCurveValue(curve, unit);
  const delta = (eq - DEFAULT_GROUND_EQ_VALUE) / DEFAULT_GROUND_EQ_VALUE;

  if (delta >= 0) {
    return clamp(value * (1 + delta * 1.8), 0, 1);
  }

  const dullness = Math.abs(delta);
  return clamp(Math.max(0, value - dullness * 0.35) * (1 - dullness * 0.35), 0, 1);
}
