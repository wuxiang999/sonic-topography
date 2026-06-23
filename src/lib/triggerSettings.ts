import type { TriggerPreset } from './AudioEngine';
import { readStorage, writeStorage } from './storage';

export const TRIGGER_SETTINGS_STORAGE_KEY = 'sonic-topography-trigger-settings-v1';

export interface StoredTriggerConfig {
  enabled: boolean;
  mode: TriggerPreset;
  freqIndex: number;
  threshold: number;
  sensitivity: number;
  cooldown: number;
  bandStart: number;
  bandEnd: number;
  pulseStrength: number;
}

export interface StoredTriggerSettings {
  Pulse?: Partial<StoredTriggerConfig>;
  Meteor?: Partial<StoredTriggerConfig>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeTriggerConfig(value: Partial<StoredTriggerConfig> | undefined) {
  if (!value) return {};

  return {
    ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
    ...(value.mode === 'Auto Beat' || value.mode === 'Advanced' ? { mode: value.mode } : {}),
    ...(Number.isFinite(value.freqIndex) ? { freqIndex: Number(value.freqIndex) } : {}),
    ...(Number.isFinite(value.threshold) ? { threshold: clamp(Number(value.threshold), 0, 1) } : {}),
    ...(Number.isFinite(value.sensitivity) ? { sensitivity: clamp(Number(value.sensitivity), 0, 1) } : {}),
    ...(Number.isFinite(value.cooldown) ? { cooldown: Math.max(0, Math.min(300, Math.round(Number(value.cooldown)))) } : {}),
    ...(Number.isFinite(value.bandStart) ? { bandStart: clampInt(Number(value.bandStart), 0, 250) } : {}),
    ...(Number.isFinite(value.bandEnd) ? { bandEnd: clampInt(Number(value.bandEnd), 2, 256) } : {}),
    ...(Number.isFinite(value.pulseStrength) ? { pulseStrength: clamp(Number(value.pulseStrength), 0, 5) } : {}),
  };
}

function normalizeTriggerSettings(raw: unknown): StoredTriggerSettings {
  const parsed = raw as StoredTriggerSettings | null | undefined;
  return {
    Pulse: normalizeTriggerConfig(parsed?.Pulse),
    Meteor: normalizeTriggerConfig(parsed?.Meteor),
  };
}

export function readTriggerSettingsStorage(): StoredTriggerSettings {
  return readStorage<StoredTriggerSettings>(TRIGGER_SETTINGS_STORAGE_KEY, {}, normalizeTriggerSettings);
}

export function writeTriggerSettingsStorage(settings: StoredTriggerSettings) {
  writeStorage(TRIGGER_SETTINGS_STORAGE_KEY, {
    Pulse: normalizeTriggerConfig(settings.Pulse),
    Meteor: normalizeTriggerConfig(settings.Meteor),
  });
}
