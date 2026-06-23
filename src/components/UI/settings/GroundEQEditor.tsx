import { useState, useRef, useEffect, useCallback } from 'react';
import { useSettings } from '../../../store/SettingsContext';
import { GROUND_EQ_POINT_COUNT, DEFAULT_GROUND_EQ_VALUE, EQ_PRESETS, EQ_PRESET_IDS } from '../../../lib/groundEqSettings';

export function GroundEQEditor({ accent }: { accent: string }) {
  const { groundEqSettings, setGroundEqSettings } = useSettings();
  const curve = groundEqSettings.curve;
  const onChange = (newCurve: number[]) => setGroundEqSettings({ curve: newCurve });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const [draggedPoint, setDraggedPoint] = useState(-1);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = (presetId: string) => {
    const preset = EQ_PRESETS[presetId];
    if (preset) {
      onChange([...preset.curve]);
      setActivePreset(presetId);
    }
  };

  const drawEQ = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '8px monospace';
    ctx.fillText('低频', 4, 12);
    ctx.fillText('中频', w / 2 - 8, 12);
    ctx.fillText('高频', w - 28, 12);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * w;
      const y = h - (curve[i] / 100) * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = `${accent}18`;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * w;
      const y = h - (curve[i] / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * w;
      const y = h - (curve[i] / 100) * h;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = draggedPoint === i ? '#fff' : accent;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [curve, accent, draggedPoint]);

  useEffect(() => {
    drawEQ();
  }, [drawEQ]);

  const getPointFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    const value = Math.max(0, Math.min(100, Math.round(y * 100)));
    const index = Math.max(0, Math.min(GROUND_EQ_POINT_COUNT - 1, Math.round(x * (GROUND_EQ_POINT_COUNT - 1))));
    return { index, value };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const pt = getPointFromEvent(e);
    if (!pt) return;
    isDragging.current = true;
    setDraggedPoint(pt.index);
    setActivePreset(null);
    const newCurve = [...curve];
    newCurve[pt.index] = pt.value;
    onChange(newCurve);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const pt = getPointFromEvent(e);
    if (!pt) return;
    const newCurve = [...curve];
    newCurve[pt.index] = pt.value;
    onChange(newCurve);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    setDraggedPoint(-1);
  };

  const handleReset = () => {
    onChange(new Array(GROUND_EQ_POINT_COUNT).fill(DEFAULT_GROUND_EQ_VALUE));
    setActivePreset(null);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] uppercase tracking-[0.15em] text-white/40">预设</span>
        <div className="flex flex-wrap gap-1">
          {EQ_PRESET_IDS.map((id) => (
            <button
              key={id}
              onClick={() => applyPreset(id)}
              className={`text-[9px] uppercase tracking-[0.1em] px-2 py-1 rounded-sm border transition-all ${
                activePreset === id ? 'text-black' : 'text-white/50 hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activePreset === id ? accent : 'transparent',
                borderColor: activePreset === id ? accent : 'rgba(255,255,255,0.1)',
              }}
            >
              {EQ_PRESETS[id].name}
            </button>
          ))}
        </div>
      </div>
      <div
        className="relative border border-white/5 rounded-sm overflow-hidden cursor-crosshair"
        style={{ aspectRatio: '2/1' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="w-full h-full block"
        />
      </div>
      <button
        onClick={handleReset}
        className="mt-2 text-[9px] uppercase tracking-[0.15em] text-white/30 hover:text-white/60 transition-colors"
      >
        重置 EQ
      </button>
    </div>
  );
}
