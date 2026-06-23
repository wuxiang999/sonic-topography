import { useSettings } from '../../../store/SettingsContext';
import type { SceneSettings } from '../SettingsPanel';
import { SliderControl, ColorButton } from '../primitives';

const SCENE_SETTINGS_KEY = 'sonic-topography-scene-settings-v1';

function saveSceneSettings(settings: SceneSettings) {
  try {
    localStorage.setItem(SCENE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function SceneSettingsSection({ accent }: { accent: string }) {
  const { sceneSettings, setSceneSettings } = useSettings();

  const update = (patch: Partial<SceneSettings>) => {
    const next = { ...sceneSettings, ...patch };
    setSceneSettings(next);
    saveSceneSettings(next);
  };

  return (
    <div>
      <div className="text-[9px] text-white/40 mb-3 leading-relaxed">
        控制 3D 场景的视觉效果参数。这些设置会实时影响渲染输出。
      </div>

      <div className="text-[10px] text-white/50 uppercase tracking-[0.15em] mb-2">迷雾</div>
      <SliderControl label="近端距离" desc="迷雾开始的距离。值越小，迷雾越早出现。" value={sceneSettings.fogNear} min={0} max={60} step={1} onChange={(v) => update({ fogNear: v })} accent={accent} />
      <SliderControl label="远端距离" desc="迷雾完全覆盖的距离。值越大，能见度越远。" value={sceneSettings.fogFar} min={20} max={150} step={1} onChange={(v) => update({ fogFar: v })} accent={accent} />
      <ColorButton label="迷雾颜色" color={sceneSettings.fogColor} onChange={(c) => update({ fogColor: c })} accent={accent} />

      <div className="text-[10px] text-white/50 uppercase tracking-[0.15em] mt-3 mb-2">场景</div>
      <SliderControl label="旋转速度" desc="3D 场景自动旋转的基础速度。主题可覆盖此值。" value={sceneSettings.rotationSpeed} min={0} max={2} step={0.1} onChange={(v) => update({ rotationSpeed: v })} accent={accent} />
      <SliderControl label="发光强度" desc="全局发光亮度倍率。" value={sceneSettings.glowIntensity} min={0.4} max={2.2} step={0.1} onChange={(v) => update({ glowIntensity: v })} accent={accent} />

      <div className="text-[10px] text-white/50 uppercase tracking-[0.15em] mt-3 mb-2">网格</div>
      <SliderControl label="网格大小" desc="地形的网格密度。值越大，地形越精细但性能消耗也越大。" value={sceneSettings.gridSize} min={30} max={120} step={10} onChange={(v) => update({ gridSize: v })} accent={accent} />

      <div className="text-[10px] text-white/50 uppercase tracking-[0.15em] mt-3 mb-2">频段增益</div>
      <div className="text-[9px] text-white/30 mb-2 leading-relaxed">单独调整每个音频频段对地形驱动的强度倍率。</div>
      <SliderControl label="次低音增益" desc="超低频（0-40Hz）的视觉影响强度。" value={sceneSettings.subBassGain} min={0} max={3} step={0.1} onChange={(v) => update({ subBassGain: v })} accent={accent} />
      <SliderControl label="低音增益" desc="低频（40-80Hz）鼓点和贝斯的视觉影响。" value={sceneSettings.bassGain} min={0} max={3} step={0.1} onChange={(v) => update({ bassGain: v })} accent={accent} />
      <SliderControl label="低中频增益" desc="低频到中频过渡段的视觉影响。" value={sceneSettings.lowMidGain} min={0} max={3} step={0.1} onChange={(v) => update({ lowMidGain: v })} accent={accent} />
      <SliderControl label="中频增益" desc="中频段人声和旋律的视觉影响。" value={sceneSettings.midGain} min={0} max={3} step={0.1} onChange={(v) => update({ midGain: v })} accent={accent} />
      <SliderControl label="高中频增益" desc="中高频段的视觉影响。" value={sceneSettings.highMidGain} min={0} max={3} step={0.1} onChange={(v) => update({ highMidGain: v })} accent={accent} />
      <SliderControl label="存在感增益" desc="高频存在感频段的视觉影响。" value={sceneSettings.presenceGain} min={0} max={3} step={0.1} onChange={(v) => update({ presenceGain: v })} accent={accent} />
      <SliderControl label="明亮度增益" desc="高频明亮度频段的视觉影响。" value={sceneSettings.brillianceGain} min={0} max={3} step={0.1} onChange={(v) => update({ brillianceGain: v })} accent={accent} />
      <SliderControl label="空气感增益" desc="极高频空气感频段的视觉影响。" value={sceneSettings.airGain} min={0} max={3} step={0.1} onChange={(v) => update({ airGain: v })} accent={accent} />

      <div className="text-[10px] text-white/50 uppercase tracking-[0.15em] mt-3 mb-2">特效限制</div>
      <SliderControl label="最大波纹数" desc="同时存在的最大波纹数量。" value={sceneSettings.maxRipples} min={1} max={20} step={1} onChange={(v) => update({ maxRipples: v })} accent={accent} />
      <SliderControl label="最大流星数" desc="同时存在的最大流星数量。" value={sceneSettings.maxMeteors} min={1} max={20} step={1} onChange={(v) => update({ maxMeteors: v })} accent={accent} />
      <SliderControl label="最大粒子数" desc="同时存在的最大粒子数量。" value={sceneSettings.maxParticles} min={5} max={80} step={5} onChange={(v) => update({ maxParticles: v })} accent={accent} />
    </div>
  );
}
