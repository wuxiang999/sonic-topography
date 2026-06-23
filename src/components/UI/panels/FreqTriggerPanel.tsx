import { useRef, useState, useEffect } from 'react';
import { engine, TriggerPreset } from '../../../lib/AudioEngine';

export function FreqTriggerPanelWrapper({ onClose, accentHex }: { onClose: () => void, accentHex: string }) {
  const [action, setAction] = useState<'Pulse' | 'Meteor'>('Meteor');
  return (
    <FreqTriggerPanel key={action} action={action} setAction={setAction} onClose={onClose} accentHex={accentHex} />
  );
}

export function FreqTriggerPanel({ action, setAction, onClose, accentHex }: { action: 'Pulse' | 'Meteor', setAction: (a: 'Pulse' | 'Meteor') => void, onClose: () => void, accentHex: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getConfig = () => action === 'Pulse' ? engine.pulseTrigger : engine.meteorTrigger;

  const [triggerPoint, setTriggerPoint] = useState({
    x: getConfig().freqIndex >= 0 ? getConfig().freqIndex / 512 : 0.5,
    y: getConfig().threshold
  });
  const [isEnabled, setIsEnabled] = useState(getConfig().enabled);
  const [mode, setMode] = useState<TriggerPreset>(getConfig().mode);
  const [sensitivity, setSensitivity] = useState(getConfig().sensitivity);
  const [cooldown, setCooldown] = useState(getConfig().cooldown);
  const [pulseStrength, setPulseStrength] = useState(getConfig().pulseStrength);
  const [bandStart, setBandStart] = useState(getConfig().bandStart);
  const [bandEnd, setBandEnd] = useState(getConfig().bandEnd);
  const isDragging = useRef(false);

  // Sync state TO engine when parameters change
  useEffect(() => {
     const c = getConfig();
     c.enabled = isEnabled;
     c.mode = mode;
     c.sensitivity = sensitivity;
     c.cooldown = cooldown;
     c.pulseStrength = pulseStrength;
     c.bandStart = bandStart;
     c.bandEnd = bandEnd;

     if (mode === 'Advanced') {
         c.freqIndex = Math.floor(triggerPoint.x * 512);
         c.threshold = triggerPoint.y;
     } else {
         c.freqIndex = -1;
     }
  }, [isEnabled, mode, sensitivity, cooldown, pulseStrength, bandStart, bandEnd, triggerPoint]);

  const handleModeChange = (newMode: TriggerPreset) => {
    setMode(newMode);
  };

  const presets: TriggerPreset[] = ['Auto Beat', 'Advanced'];

  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      for(let i=1; i<10; i++) {
         ctx.moveTo(0, height * i / 10);
         ctx.lineTo(width, height * i / 10);
         ctx.moveTo(width * i / 10, 0);
         ctx.lineTo(width * i / 10, height);
      }
      ctx.stroke();

      const data = engine.getRawFrequencyData();
      const binCount = data.length || 512;

      // Draw highlighted band
      const [startBin, endBin] = getConfig().getTriggerRange();
      const startX = (startBin / binCount) * width;
      const endX = (endBin / binCount) * width;

      ctx.fillStyle = mode === 'Advanced' ? 'rgba(255,255,255,0.02)' : `${accentHex}20`;
      ctx.fillRect(startX, 0, Math.max(1, endX - startX), height);

      if (mode !== 'Advanced') {
         ctx.strokeStyle = accentHex + '80';
         ctx.lineWidth = 1;
         ctx.beginPath();
         ctx.moveTo(endX, 0);
         ctx.lineTo(endX, height);
         ctx.stroke();
      }

      // Draw spectrum
      ctx.fillStyle = accentHex + '40';
      ctx.beginPath();
      ctx.moveTo(0, height);

      for(let i = 0; i < binCount; i++) {
         const x = (i / binCount) * width;
         const val = data[i] / 255.0;
         const y = height - (val * height);
         ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      if (mode === 'Advanced') {
          const tx = triggerPoint.x * width;
          const ty = height - (triggerPoint.y * height);

          ctx.beginPath();
          ctx.moveTo(tx, 0);
          ctx.lineTo(tx, height);
          ctx.moveTo(0, ty);
          ctx.lineTo(width, ty);
          ctx.strokeStyle = accentHex;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(tx, ty, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
      } else {
          const evE = getConfig().lastEvalEnergy;
          const evThresh = getConfig().lastEvalThresh;

          const eY = height - (evE * height);
          const tY = height - (evThresh * height);

          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.moveTo(0, tY);
          ctx.lineTo(width, tY);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.stroke();
          ctx.setLineDash([]);

          const cx = (startX + endX) / 2;
          ctx.beginPath();
          ctx.arc(cx, eY, 6, 0, Math.PI * 2);
          ctx.fillStyle = evE > evThresh ? accentHex : 'rgba(255,255,255,0.5)';
          ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [accentHex, triggerPoint, mode]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'Advanced') return;
    isDragging.current = true;
    updateTriggerFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || mode !== 'Advanced') return;
    updateTriggerFromEvent(e);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const updateTriggerFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));

    setTriggerPoint({ x, y });
    const config = action === 'Meteor' ? engine.meteorTrigger : engine.pulseTrigger;
    config.freqIndex = Math.floor(x * 512);
    config.threshold = y;
  };

  // Detect if on mobile for responsive layout inside panel
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="absolute inset-0 z-[100] backdrop-blur-md bg-black/50 flex flex-col items-center justify-center pointer-events-auto">
       <div className="w-full max-w-[800px] mx-2 border border-white/[0.08] rounded-xl p-4 sm:p-8 transform transition-all shadow-2xl max-h-screen overflow-y-auto relative" style={{ background: 'rgba(5, 10, 15, 0.95)' }}>
          <div className="absolute top-[1px] left-4 right-4 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
             <div className="flex flex-wrap items-center gap-4">
               <h2 className="text-lg sm:text-xl font-light tracking-widest text-white">频率触发</h2>
               <div className="flex flex-wrap items-center gap-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={isEnabled}
                     onChange={(e) => setIsEnabled(e.target.checked)}
                     className="w-4 h-4 rounded-sm border-white/20 bg-black/50"
                     style={{ accentColor: accentHex }}
                   />
                   <span className="text-[10px] uppercase tracking-widest text-white/50">启用</span>
                 </label>

                 {isEnabled && (
                   <div className="flex items-center rounded overflow-hidden border border-white/10 text-[10px] uppercase tracking-widest">
                     <button
                       onClick={() => setAction('Pulse')}
                       className={`px-3 py-1 transition-colors ${action === 'Pulse' ? 'text-black' : 'text-white/50 hover:bg-white/5'}`}
                       style={{ backgroundColor: action === 'Pulse' ? accentHex : 'transparent' }}
                     >
                       Pulse
                     </button>
                     <button
                       onClick={() => setAction('Meteor')}
                       className={`px-3 py-1 transition-colors ${action === 'Meteor' ? 'text-black' : 'text-white/50 hover:bg-white/5'}`}
                       style={{ backgroundColor: action === 'Meteor' ? accentHex : 'transparent' }}
                     >
                       Meteor
                     </button>
                   </div>
                 )}
               </div>
             </div>
             <button onClick={onClose} className="text-white/50 hover:text-white uppercase tracking-widest text-[10px]">关闭</button>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {presets.map(p => (
               <button
                  key={p}
                  onClick={() => handleModeChange(p)}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm border transition-colors ${
                     mode === p ? 'bg-white/10 text-white border-white/20' : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
                  }`}
               >
                  {p}
               </button>
            ))}
          </div>

          <p className="text-[11px] text-white/40 mb-6 font-mono leading-relaxed">
            {mode === 'Advanced'
              ? "Drag the crosshair to set the target frequency (X) and threshold (Y).\nWhen the spectrum exceeds this threshold, a visual pulse is triggered."
              : `Dynamic ${mode} detection enabled. Pulses trigger when instantaneous energy significantly exceeds the rolling average of this specific frequency band.`}
          </p>
           <div className={`relative w-full aspect-[2/1] bg-black/60 border border-white/[0.06] rounded overflow-hidden ${mode === 'Advanced' ? 'cursor-crosshair' : ''}`}>
             <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
             <canvas
               ref={canvasRef}
               width={800}
               height={400}
               className="w-full h-full block relative z-10"
               onPointerDown={handlePointerDown}
               onPointerMove={handlePointerMove}
               onPointerUp={handlePointerUp}
               onPointerLeave={handlePointerUp}
             />
           </div>

          {mode === 'Auto Beat' && (
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>灵敏度</span>
                    <span style={{ color: accentHex }}>{sensitivity.toFixed(2)}</span>
                 </div>
                  <input type="range" min="0" max="1" step="0.05" value={sensitivity} onChange={e => setSensitivity(parseFloat(e.target.value))} className="range-thumb w-full cursor-pointer" style={{ background: `linear-gradient(to right, ${accentHex} ${sensitivity * 100}%, rgba(255,255,255,0.05) ${sensitivity * 100}%)`, '--thumb': accentHex, '--glow': `${accentHex}33` } as React.CSSProperties}/>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                     <span>冷却(帧)</span>
                     <span style={{ color: accentHex }}>{cooldown}</span>
                  </div>
                  <input type="range" min="0" max="300" step="1" value={cooldown} onChange={e => setCooldown(parseInt(e.target.value))} className="range-thumb w-full cursor-pointer" style={{ background: `linear-gradient(to right, ${accentHex} ${(cooldown / 300) * 100}%, rgba(255,255,255,0.05) ${(cooldown / 300) * 100}%)`, '--thumb': accentHex, '--glow': `${accentHex}33` } as React.CSSProperties}/>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                     <span>频率范围 ({bandStart} - {bandEnd})</span>
                  </div>
                  <div className="flex gap-2">
                    <input type="range" min="0" max="250" step="1" value={bandStart} onChange={e => setBandStart(Math.min(parseInt(e.target.value), bandEnd - 1))} className="range-thumb w-1/2 cursor-pointer" style={{ background: `linear-gradient(to right, ${accentHex} ${(bandStart / 250) * 100}%, rgba(255,255,255,0.05) ${(bandStart / 250) * 100}%)`, '--thumb': accentHex, '--glow': `${accentHex}33` } as React.CSSProperties}/>
                    <input type="range" min="2" max="256" step="1" value={bandEnd} onChange={e => setBandEnd(Math.max(parseInt(e.target.value), bandStart + 1))} className="range-thumb w-1/2 cursor-pointer" style={{ background: `linear-gradient(to right, ${accentHex} ${(bandEnd / 256) * 100}%, rgba(255,255,255,0.05) ${(bandEnd / 256) * 100}%)`, '--thumb': accentHex, '--glow': `${accentHex}33` } as React.CSSProperties}/>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                     <span>脉冲强度</span>
                     <span style={{ color: accentHex }}>{pulseStrength.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0" max="5" step="0.1" value={pulseStrength} onChange={e => setPulseStrength(parseFloat(e.target.value))} className="range-thumb w-full cursor-pointer" style={{ background: `linear-gradient(to right, ${accentHex} ${(pulseStrength / 5) * 100}%, rgba(255,255,255,0.05) ${(pulseStrength / 5) * 100}%)`, '--thumb': accentHex, '--glow': `${accentHex}33` } as React.CSSProperties}/>
               </div>
            </div>
          )}
       </div>
    </div>
  );
}
