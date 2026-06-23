export function SliderControl({ label, desc, value, min, max, step, onChange, accent }: {
  label: string; desc?: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; accent: string;
}) {
  const pct = min < max ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-white/80">{label}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: `${accent}20`, color: accent }}>{value.toFixed(step !== undefined && step < 1 ? 2 : 0)}</span>
      </div>
      {desc && <div className="text-[9px] text-white/30 mb-2 leading-relaxed">{desc}</div>}
      <input
        type="range" min={min} max={max} step={step || 1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="range-thumb w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${accent} ${pct}%, rgba(255,255,255,0.05) ${pct}%)`,
          '--thumb': accent,
          '--glow': `${accent}33`,
        } as React.CSSProperties}
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px] text-white/20">{min}</span>
        <span className="text-[8px] text-white/20">{max}</span>
      </div>
    </div>
  );
}
