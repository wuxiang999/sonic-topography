// ── Settings Context: eliminates props drilling App → UI → SettingsPanel ──
import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { ThemeColors, CustomThemeSettings, ThemeRotationSettings } from '../lib/themes';
import { themes, CUSTOM_THEME_ID, createCustomThemeColors } from '../lib/themes';
import type { StoredGroundEqSettings } from '../lib/groundEqSettings';
import type { SceneSettings } from '../components/UI/SettingsPanel';

// ── Context value shape ──
export interface SettingsContextValue {
  // Theme
  theme: string;
  setTheme: (t: string) => void;
  resolvedTheme: ThemeColors;
  customThemes: CustomThemeSettings[];
  setCustomThemes: (settings: CustomThemeSettings[], activeId?: string) => void;
  activeCustomThemeId: string;
  setActiveCustomThemeId: (id: string) => void;
  themeRotation: ThemeRotationSettings;
  setThemeRotation: (settings: ThemeRotationSettings) => void;

  // Ground EQ
  groundEqSettings: StoredGroundEqSettings;
  setGroundEqSettings: (settings: StoredGroundEqSettings) => void;

  // Scene
  sceneSettings: SceneSettings;
  setSceneSettings: (settings: SceneSettings) => void;

  // Display
  uiHidden: boolean;
  setUiHidden: (v: boolean) => void;

  // Quality
  userQuality: 'low' | 'medium' | 'high' | null;
  setUserQuality: (v: 'low' | 'medium' | 'high' | null) => void;
  userAntialias: boolean | null;
  setUserAntialias: (v: boolean | null) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// ── Provider ──
interface SettingsProviderProps {
  children: ReactNode;
  // Initial values from App.tsx (resolvedTheme is auto-computed)
  initialTheme: string;
  initialCustomThemes: CustomThemeSettings[];
  initialActiveCustomThemeId: string;
  initialThemeRotation: ThemeRotationSettings;
  initialGroundEqSettings: StoredGroundEqSettings;
  initialSceneSettings: SceneSettings;
  initialUiHidden: boolean;
  initialUserQuality: 'low' | 'medium' | 'high' | null;
  initialUserAntialias: boolean | null;
  // Callbacks that persist to localStorage
  onThemeChange?: (t: string) => void;
  onCustomThemesChange?: (settings: CustomThemeSettings[], activeId?: string) => void;
  onThemeRotationChange?: (settings: ThemeRotationSettings) => void;
  onGroundEqSettingsChange?: (settings: StoredGroundEqSettings) => void;
  onSceneSettingsChange?: (settings: SceneSettings) => void;
  onUiHiddenChange?: (v: boolean) => void;
  onQualityChange?: (v: 'low' | 'medium' | 'high' | null) => void;
  onAntialiasChange?: (v: boolean | null) => void;
}

export function SettingsProvider({
  children,
  initialTheme,
  initialCustomThemes,
  initialActiveCustomThemeId,
  initialThemeRotation,
  initialGroundEqSettings,
  initialSceneSettings,
  initialUiHidden,
  initialUserQuality,
  initialUserAntialias,
  onThemeChange,
  onCustomThemesChange,
  onThemeRotationChange,
  onGroundEqSettingsChange,
  onSceneSettingsChange,
  onUiHiddenChange,
  onQualityChange,
  onAntialiasChange,
}: SettingsProviderProps) {
  const [theme, setThemeState] = useState(initialTheme);
  const [customThemes, setCustomThemesState] = useState(initialCustomThemes);
  const [activeCustomThemeId, setActiveCustomThemeIdState] = useState(initialActiveCustomThemeId);
  const [themeRotation, setThemeRotationState] = useState(initialThemeRotation);
  const [groundEqSettings, setGroundEqSettingsState] = useState(initialGroundEqSettings);
  const [sceneSettings, setSceneSettingsState] = useState(initialSceneSettings);
  const [uiHidden, setUiHiddenState] = useState(initialUiHidden);
  const [userQuality, setUserQualityState] = useState(initialUserQuality);
  const [userAntialias, setUserAntialiasState] = useState(initialUserAntialias);

  // Auto-compute resolvedTheme whenever theme/customThemes changes
  const activeCustomTheme = useMemo(
    () => customThemes.find((p) => p.id === activeCustomThemeId) ?? customThemes[0],
    [customThemes, activeCustomThemeId]
  );
  const resolvedTheme = useMemo(
    () => theme === CUSTOM_THEME_ID && activeCustomTheme
      ? createCustomThemeColors(activeCustomTheme)
      : (themes[theme] ?? themes.nocturnal),
    [theme, activeCustomTheme]
  );

  // Sync with external callbacks that persist
  const setTheme = useCallback((t: string) => {
    setThemeState(t);
    onThemeChange?.(t);
  }, [onThemeChange]);

  const setCustomThemes = useCallback((settings: CustomThemeSettings[], activeId?: string) => {
    setCustomThemesState(settings);
    if (activeId !== undefined) setActiveCustomThemeIdState(activeId);
    onCustomThemesChange?.(settings, activeId);
  }, [onCustomThemesChange]);

  const setThemeRotation = useCallback((settings: ThemeRotationSettings) => {
    setThemeRotationState(settings);
    onThemeRotationChange?.(settings);
  }, [onThemeRotationChange]);

  const setGroundEqSettings = useCallback((settings: StoredGroundEqSettings) => {
    setGroundEqSettingsState(settings);
    onGroundEqSettingsChange?.(settings);
  }, [onGroundEqSettingsChange]);

  const setSceneSettings = useCallback((settings: SceneSettings) => {
    setSceneSettingsState(settings);
    onSceneSettingsChange?.(settings);
  }, [onSceneSettingsChange]);

  const setUiHidden = useCallback((v: boolean) => {
    setUiHiddenState(v);
    onUiHiddenChange?.(v);
  }, [onUiHiddenChange]);

  const setUserQuality = useCallback((v: 'low' | 'medium' | 'high' | null) => {
    setUserQualityState(v);
    onQualityChange?.(v);
  }, [onQualityChange]);

  const setUserAntialias = useCallback((v: boolean | null) => {
    setUserAntialiasState(v);
    onAntialiasChange?.(v);
  }, [onAntialiasChange]);

  const value: SettingsContextValue = useMemo(() => ({
    theme, setTheme,
    resolvedTheme,
    customThemes, setCustomThemes,
    activeCustomThemeId, setActiveCustomThemeId: setActiveCustomThemeIdState,
    themeRotation, setThemeRotation,
    groundEqSettings, setGroundEqSettings,
    sceneSettings, setSceneSettings,
    uiHidden, setUiHidden,
    userQuality, setUserQuality,
    userAntialias, setUserAntialias,
  }), [
    theme, resolvedTheme, customThemes, activeCustomThemeId, themeRotation,
    groundEqSettings, sceneSettings, uiHidden, userQuality, userAntialias,
    setTheme, setCustomThemes, setThemeRotation, setGroundEqSettings,
    setSceneSettings, setUiHidden, setUserQuality, setUserAntialias,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
