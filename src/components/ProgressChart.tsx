interface Props {
  points: { date: string; weight: number }[];
  width?: number;
  height?: number;
}

/** 某个动作每次训练的最大重量走势。数据点少于 2 个就没必要画图。 */
export function ProgressChart({ points, width = 260, height = 56 }: Props) {
  if (points.length < 2) return null;

  const pad = 6;
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;

  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (w: number) => height - pad - ((w - min) / span) * (height - pad * 2);

  const line = points.map((p, i) => `${x(i)},${y(p.weight)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.weight - first.weight;

  return (
    <div className="chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最大重量走势">
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.weight)} r={2.5} fill="var(--accent)" />
        ))}
      </svg>
      <span className="chart-note">
        {first.date.slice(5)} → {last.date.slice(5)}　最大重量 {first.weight} → {last.weight} kg
        {delta !== 0 && (
          <b className={delta > 0 ? 'up' : 'down'}>
            {delta > 0 ? ' ↑' : ' ↓'}
            {Math.abs(delta)} kg
          </b>
        )}
      </span>
    </div>
  );
}
