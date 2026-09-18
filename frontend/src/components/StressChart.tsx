import React, { useState, useEffect } from 'react';
import { StressTrendPoint } from '../api/types';
import { apiClient } from '../api/client';
import { Calendar, Activity, Info } from 'lucide-react';

interface StressChartProps {
  onRefreshTrigger?: number;
}

export const StressChart: React.FC<StressChartProps> = ({ onRefreshTrigger = 0 }) => {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [data, setData] = useState<StressTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<StressTrendPoint | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient.getStressTrend(range).then((points) => {
      if (mounted) {
        setData(points);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [range, onRefreshTrigger]);

  // Chart dimensions & SVG math
  const width = 760;
  const height = 240;
  const paddingX = 45;
  const paddingY = 30;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Max scale is 10, min scale is 1
  const minVal = 1;
  const maxVal = 10;

  const pointsCount = data.length;

  const getX = (index: number) => {
    if (pointsCount <= 1) return paddingX + chartWidth / 2;
    return paddingX + (index / (pointsCount - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    // 10 at top, 1 at bottom
    const normalized = (val - minVal) / (maxVal - minVal);
    return height - paddingY - normalized * chartHeight;
  };

  // Generate SVG path line and area
  let linePath = '';
  let areaPath = '';

  if (data.length > 0) {
    const coords = data.map((d, i) => ({ x: getX(i), y: getY(d.score) }));

    linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      // Gentle curve using bezier smoothing
      const prev = coords[i - 1];
      const curr = coords[i];
      const midX = (prev.x + curr.x) / 2;
      linePath += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const bottomY = height - paddingY;
    areaPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }

  // Calculate statistics
  const avgScore =
    data.length > 0
      ? (data.reduce((acc, d) => acc + d.score, 0) / data.length).toFixed(1)
      : '0.0';
  const peakScore =
    data.length > 0 ? Math.max(...data.map((d) => d.score)).toFixed(1) : '0.0';

  return (
    <section className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 shadow-resting space-y-5">
      {/* Header and 7d/30d Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-headline text-lg font-medium text-on-surface">
              Stress Index Trend
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant">
            Derived quietly from your daily energy &amp; reflection checks
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setRange('7d')}
            className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all ${
              range === '7d'
                ? 'bg-surfaceLowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Past 7 Days
          </button>
          <button
            type="button"
            onClick={() => setRange('30d')}
            className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all ${
              range === '30d'
                ? 'bg-surfaceLowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Past 30 Days
          </button>
        </div>
      </div>

      {/* Ambient Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant">
          <span className="text-xs text-on-surface-variant">Average Stress Index</span>
          <p className="font-headline text-xl font-semibold text-primary pt-0.5">
            {avgScore} <span className="text-xs text-outline font-normal">/ 10</span>
          </p>
        </div>
        <div className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant">
          <span className="text-xs text-on-surface-variant">Peak Level Observed</span>
          <p className="font-headline text-xl font-semibold text-on-surface pt-0.5">
            {peakScore} <span className="text-xs text-outline font-normal">/ 10</span>
          </p>
        </div>
        <div className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant col-span-2 sm:col-span-1">
          <span className="text-xs text-on-surface-variant">Consistency Signal</span>
          <p className="font-headline text-sm font-medium text-primary pt-1.5 flex items-center space-x-1">
            <span>Steady presence</span>
          </p>
        </div>
      </div>

      {/* SVG Chart Graphic */}
      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[620px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
            aria-label="Stress index trend chart"
          >
            <defs>
              <linearGradient id="calmAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5B7563" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#E8EFE9" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines (Levels 2, 5, 8) */}
            {[2, 5, 8].map((level) => {
              const y = getY(level);
              return (
                <g key={level}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="#DCE3DD"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#737973"
                    className="font-mono"
                  >
                    {level}
                  </text>
                </g>
              );
            })}

            {/* Soft Area fill */}
            {areaPath && <path d={areaPath} fill="url(#calmAreaGradient)" />}

            {/* Main Trend Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#5B7563"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Data point dots & hit areas */}
            {data.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.score);
              const isHovered = hoveredPoint?.date === d.date;

              return (
                <g key={d.date} className="cursor-pointer">
                  {/* Invisible hit circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="12"
                    fill="transparent"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Visual circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill="#FFFFFF"
                    stroke="#5B7563"
                    strokeWidth={isHovered ? '3' : '2'}
                    className="transition-all duration-150"
                  />
                  {/* X-axis date labels */}
                  {(range === '7d' || i % 4 === 0 || i === data.length - 1) && (
                    <text
                      x={cx}
                      y={height - 8}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#687770"
                      className="font-sans"
                    >
                      {d.label || d.date.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Floating Tooltip when hovered */}
        {hoveredPoint && (
          <div className="absolute top-2 right-4 bg-surfaceLowest border border-outline-variant p-2 rounded-xl shadow-lift text-xs space-y-0.5 pointer-events-none">
            <p className="font-semibold text-primary">Stress: {hoveredPoint.score} / 10</p>
            <p className="text-on-surface-variant">{hoveredPoint.date}</p>
            <p className="text-[10px] text-outline">
              {hoveredPoint.checkinCount > 0
                ? `${hoveredPoint.checkinCount} check-in(s)`
                : 'Interpolated rhythm'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1.5 text-xs text-on-surface-variant/80 pt-1">
        <Info className="w-3.5 h-3.5 text-outline flex-shrink-0" />
        <span>
          Lower scores reflect calm centeredness. Scores are private and never shared with advertisers.
        </span>
      </div>
    </section>
  );
};
