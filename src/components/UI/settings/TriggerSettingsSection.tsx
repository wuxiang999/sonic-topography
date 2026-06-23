import { useState, useEffect } from 'react';
import { engine } from '../../../lib/AudioEngine';
import { Toggle, SliderControl } from '../primitives';

export function TriggerSettingsSection({ accent }: { accent: string }) {
  const [action, setAction] = useState<'Pulse' | 'Meteor'>('Pulse');
  const getConfig = () => action === 'Pulse' ? engine.pulseTrigger : engine.meteorTrigger;
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);

  useEffect(() => {
    engine.saveTriggerSettingsToStorage();
  }, []);

  return (
    <div>
      <div className="flex gap-1 mb-3">
        <button onClick={() => setAction('Pulse')}
          className={`text-[9px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm border transition-colors ${action === 'Pulse' ? 'text-black' : 'text-white/50 hover:bg-white/5'}`}
          style={{ backgroundColor: action === 'Pulse' ? accent : 'transparent', borderColor: action === 'Pulse' ? accent : 'rgba(255,255,255,0.1)' }}>
          脉冲
        </button>
        <button onClick={() => setAction('Meteor')}
          className={`text-[9px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm border transition-colors ${action === 'Meteor' ? 'text-black' : 'text-white/50 hover:bg-white/5'}`}
          style={{ backgroundColor: action === 'Meteor' ? accent : 'transparent', borderColor: action === 'Meteor' ? accent : 'rgba(255,255,255,0.1)' }}>
          流星
        </button>
      </div>

      <div className="text-[9px] text-white/40 mb-3 leading-relaxed">
        {action === 'Pulse'
          ? '脉冲特效：当音乐达到一定强度时，在地面上产生扩散的波纹脉冲。'
          : '流星特效：当音乐高频能量达到阈值时，从天空坠落的发光流星。'}
      </div>

      <Toggle label="启用" value={getConfig().enabled} onChange={(v) => { getConfig().enabled = v; rerender(); }} accent={accent} />

      <div className="flex gap-1 mb-3 mt-2">
        {(['Auto Beat', 'Advanced'] as const).map(mode => (
          <button key={mode} onClick={() => { getConfig().mode = mode; rerender(); }}
            className={`text-[9px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-sm border transition-colors ${getConfig().mode === mode ? 'text-white border-white/20 bg-white/10' : 'text-white/40 border-transparent hover:bg-white/5'}`}>
            {mode}
          </button>
        ))}
      </div>

      {getConfig().mode === 'Auto Beat' ? (
        <>
          <SliderControl label="灵敏度" desc="检测击打的敏感度。值越高，越容易触发。" value={getConfig().sensitivity} min={0} max={1} step={0.05} onChange={(v) => { getConfig().sensitivity = v; rerender(); }} accent={accent} />
          <SliderControl label="冷却(帧)" desc="触发后的等待帧数，防止连续触发。" value={getConfig().cooldown} min={0} max={300} step={1} onChange={(v) => { getConfig().cooldown = v; rerender(); }} accent={accent} />
          <SliderControl label="频段起始" desc="检测的频段范围起始位置。" value={getConfig().bandStart} min={0} max={250} step={1} onChange={(v) => { getConfig().bandStart = Math.min(v, getConfig().bandEnd - 1); rerender(); }} accent={accent} />
          <SliderControl label="频段结束" desc="检测的频段范围结束位置。" value={getConfig().bandEnd} min={2} max={256} step={1} onChange={(v) => { getConfig().bandEnd = Math.max(v, getConfig().bandStart + 1); rerender(); }} accent={accent} />
          <SliderControl label="脉冲强度" desc="触发时脉冲/流星的视觉强度。" value={getConfig().pulseStrength} min={0} max={5} step={0.1} onChange={(v) => { getConfig().pulseStrength = v; rerender(); }} accent={accent} />
        </>
      ) : (
        <>
          <SliderControl label="阈值" desc="频段能量超过此值时触发。" value={getConfig().threshold} min={0} max={1} step={0.05} onChange={(v) => { getConfig().threshold = v; rerender(); }} accent={accent} />
        </>
      )}
    </div>
  );
}
