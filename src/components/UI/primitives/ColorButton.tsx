export function ColorButton({ label, color, onChange, accent }: {
  label: string; color: string; onChange: (c: string) => void; accent: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] text-white/70 min-w-[48px]">{label}</span>
      <div className="relative group">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div
          className="w-7 h-7 rounded-sm border border-white/10 cursor-pointer transition-all duration-200 group-hover:scale-110 group-hover:shadow-[0_0_12px_var(--glow)]"
          style={{ backgroundColor: color, '--glow': `${color}66` } as React.CSSProperties}
        />
      </div>
      <span className="text-[9px] font-mono text-white/40">{color}</span>
    </div>
  );
}
