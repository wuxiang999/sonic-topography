import { useState } from 'react';
import { useSettings } from '../../../store/SettingsContext';
import { createCustomThemePreset } from '../../../lib/themes';
import type { CustomThemeSettings } from '../../../lib/themes';
import { ColorButton, SliderControl, Toggle } from '../primitives';

export function CustomThemeEditor({ accent }: { accent: string }) {
  const { customThemes, activeCustomThemeId, setCustomThemes } = useSettings();
  const activeTheme = customThemes.find(t => t.id === activeCustomThemeId) || customThemes[0];
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingTheme = customThemes.find(t => t.id === editingId) || activeTheme;

  const updateEditingTheme = (patch: Partial<CustomThemeSettings>) => {
    if (!editingId) return;
    const updated = customThemes.map(t => t.id === editingId ? { ...t, ...patch } : t);
    setCustomThemes(updated, editingId);
  };

  return (
    <div>
      <div className="text-[9px] text-white/40 mb-3 leading-relaxed">
        自定义主题包含完整的颜色方案、发光强度、旋转速度和播放器显示控制。你可以保存多个主题并在它们之间切换。
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {customThemes.map(t => (
          <button key={t.id} onClick={() => setEditingId(t.id)}
            className={`text-[9px] px-2.5 py-1.5 rounded-sm border transition-colors ${editingId === t.id ? 'text-white border-white/20 bg-white/10' : 'text-white/40 border-transparent hover:bg-white/5'}`}>
            {t.name}
          </button>
        ))}
        <button onClick={() => {
          const preset = createCustomThemePreset({ name: `主题 ${customThemes.length + 1}` });
          setCustomThemes([...customThemes, preset], preset.id);
          setEditingId(preset.id);
        }}
          className="text-[9px] px-2.5 py-1.5 rounded-sm border border-dashed border-white/10 text-white/30 hover:text-white/60">
          + 新建
        </button>
      </div>

      {editingId && (
        <div className="space-y-3">
          <div>
            <span className="text-[10px] text-white/60 block mb-1">名称</span>
            <input type="text" value={editingTheme.name}
              onChange={(e) => updateEditingTheme({ name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-sm px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="text-[10px] text-white/50 uppercase tracking-[0.15em] mb-1">颜色方案</div>
          <ColorButton label="背景" color={editingTheme.background} onChange={(c) => updateEditingTheme({ background: c })} accent={accent} />
          <ColorButton label="冷色" color={editingTheme.cool} onChange={(c) => updateEditingTheme({ cool: c })} accent={accent} />
          <ColorButton label="暖色" color={editingTheme.warm} onChange={(c) => updateEditingTheme({ warm: c })} accent={accent} />
          <ColorButton label="强调色" color={editingTheme.accent} onChange={(c) => updateEditingTheme({ accent: c })} accent={accent} />

          <SliderControl label="发光强度" desc="整体发光的亮度等级。" value={editingTheme.glowIntensity} min={0.4} max={2.2} step={0.1} onChange={(v) => updateEditingTheme({ glowIntensity: v })} accent={accent} />
          <SliderControl label="旋转速度" desc="3D 场景自动旋转的速度。" value={editingTheme.rotationSpeed} min={0} max={2} step={0.1} onChange={(v) => updateEditingTheme({ rotationSpeed: v })} accent={accent} />
          <Toggle label="显示播放器" desc="显示右上角的播放控制卡片。" value={editingTheme.showPlayerPanel} onChange={(v) => updateEditingTheme({ showPlayerPanel: v })} accent={accent} />

          {customThemes.length > 1 && (
            <button onClick={() => {
              const remaining = customThemes.filter(t => t.id !== editingId);
              const newActive = remaining[0]?.id || '';
              setCustomThemes(remaining, newActive);
              setEditingId(remaining[0]?.id || null);
            }}
              className="text-[9px] uppercase tracking-[0.15em] text-red-400/60 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 px-3 py-1.5 rounded-sm transition-colors">
              删除此主题
            </button>
          )}
        </div>
      )}
    </div>
  );
}
