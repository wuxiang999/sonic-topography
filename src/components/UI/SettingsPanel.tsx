import { X, Download, Cookie, Palette, Sliders, Cloud, Radio, Eye, Layers, Music } from 'lucide-react';
import { themes, CUSTOM_THEME_ID, BUILT_IN_THEME_IDS } from '../../lib/themes';
import { useSettings } from '../../store/SettingsContext';
import { Section, SliderControl, Toggle } from './primitives';
import { PresetTransfer, NeteaseCookieSection, CustomThemeEditor, GroundEQEditor, TriggerSettingsSection, SceneSettingsSection } from './settings';

export type LyricsStyleOption = '滚动' | '居中' | '高亮';

export interface SceneSettings {
  fogNear: number;
  fogFar: number;
  fogColor: string;
  gridSize: number;
  bassGain: number;
  midGain: number;
  trebleGain: number;
  subBassGain: number;
  lowMidGain: number;
  highMidGain: number;
  presenceGain: number;
  brillianceGain: number;
  airGain: number;
  glowIntensity: number;
  rotationSpeed: number;
  maxRipples: number;
  maxMeteors: number;
  maxParticles: number;
}

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  fogNear: 30,
  fogFar: 95,
  fogColor: '#0a0a12',
  gridSize: 80,
  bassGain: 1.0,
  midGain: 1.0,
  trebleGain: 1.0,
  subBassGain: 1.0,
  lowMidGain: 1.0,
  highMidGain: 1.0,
  presenceGain: 1.0,
  brillianceGain: 1.0,
  airGain: 1.0,
  glowIntensity: 1.0,
  rotationSpeed: 0.5,
  maxRipples: 6,
  maxMeteors: 5,
  maxParticles: 15,
};

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  neteaseCookie: string;
  onNeteaseCookieChange: (cookie: string) => void;
  lyricsVisible: boolean;
  onLyricsVisibleChange: (v: boolean) => void;
  lyricsStyle: LyricsStyleOption;
  onLyricsStyleChange: (style: LyricsStyleOption) => void;
  accentHex: string;
  maxHistoryItems: number;
  onMaxHistoryChange: (n: number) => void;
  showStats: boolean;
  onStatsVisibleChange: (v: boolean) => void;
}

const lyricsStyles: { value: LyricsStyleOption; label: string; desc: string }[] = [
  { value: '滚动', label: '滚动', desc: '3D 透视滚动' },
  { value: '居中', label: '居中', desc: '居中简洁' },
  { value: '高亮', label: '高亮', desc: '逐字高亮' },
];

export function SettingsPanel({
  isOpen,
  onClose,
  neteaseCookie,
  onNeteaseCookieChange,
  lyricsVisible,
  onLyricsVisibleChange,
  lyricsStyle,
  onLyricsStyleChange,
  accentHex,
  maxHistoryItems,
  onMaxHistoryChange,
  showStats,
  onStatsVisibleChange,
}: SettingsPanelProps) {
  const {
    theme, resolvedTheme,
    themeRotation,
    uiHidden, userQuality, userAntialias,
    setTheme: onThemeChange,
    setThemeRotation: onThemeRotationChange,
    setUiHidden: onUiHiddenChange,
    setUserQuality: onQualityChange,
    setUserAntialias: onAntialiasChange,
  } = useSettings();

  if (!isOpen) return null;

  const bgColor = `#${resolvedTheme.uBaseColor1.getHexString()}`;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-auto flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative border border-white/[0.08] rounded-sm overflow-hidden w-[520px] max-w-[92vw] max-h-[85vh] overflow-y-auto pointer-events-auto shadow-2xl"
        style={{ background: 'rgba(4,8,16,0.97)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-white/[0.06]"
          style={{ background: 'rgba(4,8,16,0.98)' }}>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-[12px] uppercase tracking-[0.2em] text-white/70">
              全部设置
            </span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          <Section icon={<Download size={14} />} title="预设迁移" desc="一键导入/导出所有设置" accent={accentHex}>
            <PresetTransfer accent={accentHex} />
          </Section>

          <Section icon={<Cookie size={14} />} title="网易云 Cookie" desc="管理网易云音乐登录凭证" accent={accentHex}>
            <NeteaseCookieSection cookie={neteaseCookie} onCookieChange={onNeteaseCookieChange} accent={accentHex} />
          </Section>

          <Section icon={<Palette size={14} />} title="主题" desc="选择内置主题或创建自定义配色方案" accent={accentHex}>
            <div className="flex flex-wrap gap-1 mb-3">
              {BUILT_IN_THEME_IDS.map(tid => (
                <button key={tid} onClick={() => onThemeChange(tid)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-sm border transition-all ${theme === tid ? 'text-black' : 'text-white/50 hover:text-white'}`}
                  style={{
                    backgroundColor: theme === tid ? accentHex : 'transparent',
                    borderColor: theme === tid ? accentHex : 'rgba(255,255,255,0.08)',
                  }}>
                  {themes[tid]?.name || tid}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 text-[10px] text-white/40">或选择自定义主题：</div>
              <button onClick={() => onThemeChange(CUSTOM_THEME_ID)}
                className={`text-[9px] px-2.5 py-1 rounded-sm border transition-all ${theme === CUSTOM_THEME_ID ? 'text-black' : 'text-white/50'}`}
                style={{
                  backgroundColor: theme === CUSTOM_THEME_ID ? accentHex : 'transparent',
                  borderColor: theme === CUSTOM_THEME_ID ? accentHex : 'rgba(255,255,255,0.08)',
                }}>
                自定义
              </button>
            </div>

            <div className="border-t border-white/5 pt-3 mt-3">
              <Toggle label="主题自动轮换" desc="按设定的时间间隔自动切换主题。" value={themeRotation.enabled}
                onChange={(v) => onThemeRotationChange({ ...themeRotation, enabled: v })} accent={accentHex} />
              {themeRotation.enabled && (
                <>
                  <SliderControl label="切换间隔（秒）" desc="每隔多少秒自动切换到下一个主题。" value={themeRotation.intervalSeconds}
                    min={3} max={300} step={1} onChange={(v) => onThemeRotationChange({ ...themeRotation, intervalSeconds: v })} accent={accentHex} />
                  <div className="mt-2">
                    <span className="text-[10px] text-white/60 block mb-1">轮换主题</span>
                    <div className="flex flex-wrap gap-1">
                      {BUILT_IN_THEME_IDS.filter(tid => themes[tid]).map(tid => (
                        <label key={tid} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={themeRotation.themeIds.includes(tid)}
                            onChange={() => {
                              const nextIds = themeRotation.themeIds.includes(tid)
                                ? themeRotation.themeIds.filter(id => id !== tid)
                                : [...themeRotation.themeIds, tid];
                              if (nextIds.length >= 2) {
                                onThemeRotationChange({ ...themeRotation, themeIds: nextIds });
                              }
                            }}
                            className="w-3 h-3 rounded-sm"
                            style={{ accentColor: accentHex }} />
                          <span className="text-[10px] text-white/60">{themes[tid]?.name || tid}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-white/5 pt-3 mt-3">
              <div className="text-[10px] text-white/50 uppercase tracking-[0.15em] mb-2">自定义主题编辑器</div>
              <CustomThemeEditor accent={accentHex} />
            </div>
          </Section>

          <Section icon={<Sliders size={14} />} title="地面 EQ" desc="调整每个频段对地形反应的视觉强度" accent={accentHex}>
            <GroundEQEditor accent={accentHex} />
          </Section>

          <Section icon={<Cloud size={14} />} title="场景与迷雾" desc="调整 3D 场景、迷雾、频段增益等参数" accent={accentHex}>
            <SceneSettingsSection accent={accentHex} />
          </Section>

          <Section icon={<Radio size={14} />} title="频率触发" desc="脉冲和流星特效的触发参数" accent={accentHex}>
            <TriggerSettingsSection accent={accentHex} />
          </Section>

          <Section icon={<Eye size={14} />} title="显示设置" desc="控制界面上各个元素的可见性" accent={accentHex}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] text-white/80 block">频段数值</span>
                <span className="text-[9px] text-white/30">显示 Bass / Mid / Treble / Energy 实时数值</span>
              </div>
              <button onClick={() => onStatsVisibleChange(!showStats)}
                className="text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm border transition-all"
                style={{
                  backgroundColor: showStats ? `${accentHex}20` : 'transparent',
                  borderColor: showStats ? accentHex : 'rgba(255,255,255,0.1)',
                  color: showStats ? accentHex : 'rgba(255,255,255,0.45)',
                }}>
                {showStats ? '显示' : '隐藏'}
              </button>
            </div>

            <Toggle label="显示歌词" desc="显示左侧歌词面板。" value={lyricsVisible} onChange={onLyricsVisibleChange} accent={accentHex} />
            <div className="mt-2">
              <span className="text-[10px] text-white/60 block mb-1">歌词样式</span>
              <div className="grid grid-cols-3 gap-1.5">
                {lyricsStyles.map((style) => (
                  <button key={style.value} onClick={() => onLyricsStyleChange(style.value)}
                    className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-sm border transition-all"
                    style={{
                      backgroundColor: lyricsStyle === style.value ? `${accentHex}20` : 'transparent',
                      borderColor: lyricsStyle === style.value ? accentHex : 'rgba(255,255,255,0.08)',
                    }}>
                    <span className="text-[10px]" style={{ color: lyricsStyle === style.value ? accentHex : 'rgba(255,255,255,0.7)' }}>
                      {style.label}
                    </span>
                    <span className="text-[8px] text-white/30">{style.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-white/80 block">无 UI 模式</span>
                  <span className="text-[9px] text-white/30">一键隐藏所有界面元素（含 Logo），快捷键 U</span>
                </div>
                <button onClick={() => onUiHiddenChange?.(!uiHidden)}
                  className="text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm border transition-all"
                  style={{
                    backgroundColor: uiHidden ? `${accentHex}20` : 'transparent',
                    borderColor: uiHidden ? accentHex : 'rgba(255,255,255,0.1)',
                    color: uiHidden ? accentHex : 'rgba(255,255,255,0.45)',
                  }}>
                  {uiHidden ? '已隐藏' : '隐藏全部'}
                </button>
              </div>
            </div>
          </Section>

          <Section icon={<Layers size={14} />} title="画质 & 性能" desc="调整渲染质量以适应不同性能的设备" accent={accentHex}>
            <div className="mb-3">
              <span className="text-[11px] text-white/80 block mb-1">渲染质量</span>
              <span className="text-[9px] text-white/30 block mb-2">低 = 50网格 | 中 = 80网格 | 高 = 100网格。更高的值消耗更多性能。</span>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button key={level} onClick={() => onQualityChange?.(userQuality === level ? null : level)}
                    className="flex-1 text-[10px] uppercase tracking-[0.1em] py-2 rounded-sm border transition-all"
                    style={{
                      backgroundColor: (userQuality || null) === level || (!userQuality && level === 'medium') ? `${accentHex}20` : 'transparent',
                      borderColor: (userQuality || null) === level || (!userQuality && level === 'medium') ? accentHex : 'rgba(255,255,255,0.08)',
                      color: (userQuality || null) === level || (!userQuality && level === 'medium') ? accentHex : 'rgba(255,255,255,0.5)',
                    }}>
                    {level === 'low' ? '低' : level === 'medium' ? '中' : '高'}
                  </button>
                ))}
              </div>
              {!userQuality && (
                <div className="text-[8px] text-white/20 tracking-[0.1em] uppercase mt-1 text-center">
                  当前：自动检测
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-white/80 block">抗锯齿 (AA)</span>
                <span className="text-[9px] text-white/30">平滑边缘，自动 = 设备自适应</span>
              </div>
              <div className="flex gap-1.5">
                {[null, true, false].map((v) => {
                  const active = userAntialias === v || (!userAntialias && v === null);
                  return (
                    <button key={String(v)} onClick={() => onAntialiasChange?.(v === null ? null : v)}
                      className="text-[9px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-sm border transition-all"
                      style={{
                        backgroundColor: active ? `${accentHex}20` : 'transparent',
                        borderColor: active ? accentHex : 'rgba(255,255,255,0.08)',
                        color: active ? accentHex : 'rgba(255,255,255,0.4)',
                      }}>
                      {v === null ? '自动' : v ? '开' : '关'}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section icon={<Music size={14} />} title="播放记录" desc="控制播放历史记录的保存数量" accent={accentHex}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/80">保留条数</span>
              <span className="text-[11px] font-mono" style={{ color: accentHex }}>{maxHistoryItems}</span>
            </div>
            <SliderControl label="" value={maxHistoryItems} min={10} max={100} step={10} onChange={onMaxHistoryChange} accent={accentHex} />
            <div className="text-[9px] text-white/30 mt-1">最多保留多少条播放记录，超出后自动移除最早的记录。</div>
          </Section>
        </div>
      </div>
    </div>
  );
}
