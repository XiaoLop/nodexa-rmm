export function ConnectionSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${38 - (value / max) * 30}`).join(' ');
  return (
    <svg className="workspace-connection-chart" viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="连接延迟趋势">
      <defs><linearGradient id="workspace-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f80ff" stopOpacity=".32" /><stop offset="1" stopColor="#2f80ff" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,42 ${points} 100,42`} fill="url(#workspace-chart-fill)" />
      <polyline points={points} fill="none" stroke="#3d91ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
