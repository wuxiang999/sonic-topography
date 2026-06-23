export function Toggle({ label, desc, value, onChange, accent }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; accent: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2 last:mb-0">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] text-white/80">{label}</span>
        {desc && <div className="text-[9px] text-white/30 mt-0.5">{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="toggle-switch flex-shrink-0 ml-3"
        style={{ '--active': accent } as React.CSSProperties}
      >
        <div className={`toggle-track ${value ? 'active' : ''}`} />
        <div className={`toggle-thumb ${value ? 'active' : ''}`} />
      </button>
    </div>
  );
}
