export function BarChart({ data, height = 140, fmt = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height / 2 + 14}`} className="chart" preserveAspectRatio="none" role="img">
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 2 - 6);
        return (
          <g key={d.label}>
            <rect x={i * w + w * 0.18} y={height / 2 - h} width={w * 0.64} height={h} rx="1" fill="var(--brand)"><title>{`${d.label}: ${fmt(d.value)}`}</title></rect>
            <text x={i * w + w / 2} y={height / 2 + 9} fontSize="4" textAnchor="middle" fill="var(--muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ data }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="empty">No data yet.</p>;
  return (
    <div className="hbars">
      {entries.map(([k, v]) => (
        <div className="hbar" key={k}>
          <span className="hl">{k}</span>
          <div className="ht"><div className="hf" style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="hv">{v}</span>
        </div>
      ))}
    </div>
  );
}
