import React, { useState, useEffect } from 'react';
import { StressTrendPoint, LongitudinalTrendResponse } from '../api/types';
import { apiClient } from '../api/client';
import { Activity, Info } from 'lucide-react';

interface StressChartProps {
  onRefreshTrigger?: number;
}

export const StressChart: React.FC<StressChartProps> = ({ onRefreshTrigger = 0 }) => {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [trendResp, setTrendResp] = useState<LongitudinalTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<StressTrendPoint | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient.getLongitudinalTrends(range).then((resp) => {
      if (mounted) {
        setTrendResp(resp);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [range, onRefreshTrigger]);

  const data = trendResp?.points || [];
  const minimumNMet = trendResp?.minimum_n_met ?? false;
  const distinctDays = trendResp?.distinct_days ?? 0;
  const status = trendResp?.status ?? 'calibrating';

  // Chart dimensions & SVG math (0 - 100 scale)
  const width = 760;
  const height = 240;
  const paddingX = 45;
  const paddingY = 30;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const pointsCount = data.length;

  const getX = (index: number) => {
    if (pointsCount <= 1) return paddingX + chartWidth / 2;
    return paddingX + (index / (pointsCount - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const normalized = Math.max(0, Math.min(100, val)) / 100;
    return height - paddingY - normalized * chartHeight;
  };

  const activePoints = data.filter((d) => d.checkinCount > 0);
  let linePath = '';
  let areaPath = '';

  if (minimumNMet && data.length > 0) {
    const coords = data.map((d, i) => ({ x: getX(i), y: getY(d.score) }));

    linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
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

  const avgScore =
    activePoints.length > 0
      ? (activePoints.reduce((acc, d) => acc + d.score, 0) / activePoints.length).toFixed(1)
      : '—';
  const peakScore =
    activePoints.length > 0 ? Math.max(...activePoints.map((d) => d.score)).toFixed(1) : '—';

  return (
    <section className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 sm:p-7 shadow-resting space-y-6">
      {/* Header and 7d/30d Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-headline text-lg sm:text-xl font-semibold text-on-surface">
              Stress Index Trend (0–100)
            </h3>
          </div>
          <p className="text-sm text-stone-700">
            Daily stress metrics with distinct-day confidence gating
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setRange('7d')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              range === '7d'
                ? 'bg-surfaceLowest text-primary-dark shadow-xs'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            Past 7 Days
          </button>
          <button
            type="button"
            onClick={() => setRange('30d')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              range === '30d'
                ? 'bg-surfaceLowest text-primary-dark shadow-xs'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            Past 30 Days
          </button>
        </div>
      </div>

      {/* Ambient Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <div className="p-4 rounded-xl bg-surface-container-low/70 border border-outline-variant">
          <span className="text-sm font-medium text-stone-700">Average Stress Index</span>
          <p className="font-headline text-2xl font-bold text-primary-dark pt-1">
            {avgScore} <span className="text-sm text-stone-700 font-normal">/ 100</span>
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface-container-low/70 border border-outline-variant">
          <span className="text-sm font-medium text-stone-700">Peak Observed</span>
          <p className="font-headline text-2xl font-bold text-on-surface pt-1">
            {peakScore} <span className="text-sm text-stone-700 font-normal">/ 100</span>
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface-container-low/70 border border-outline-variant">
          <span className="text-sm font-medium text-stone-700">Baseline Status</span>
          <p className="font-headline text-base font-bold text-primary-dark pt-1 capitalize">
            {status === 'calibrated'
              ? 'Calibrated Baseline'
              : status === 'preliminary'
              ? `Preliminary (${distinctDays}/7 days)`
              : `Calibrating (${distinctDays}/5 days)`}
          </p>
        </div>
      </div>

      {/* Calibration Notice */}
      {!minimumNMet && (
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant space-y-1 text-sm text-stone-700">
          <p className="font-semibold text-on-surface">
            {distinctDays < 5
              ? `Calibrating baseline (Day ${distinctDays} of 5)`
              : `Preliminary baseline (Day ${distinctDays} of 7)`}
          </p>
          <p className="leading-relaxed">
            {distinctDays < 5
              ? 'Longitudinal trend curves remain shielded until check-ins across 5 distinct calendar days are recorded to prevent misleading early volatility.'
              : 'Your preliminary baseline is active. Reaching 7 calendar days unlocks full statistical trend directionality.'}
          </p>
        </div>
      )}

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

            {/* Horizontal Grid lines (Levels 25, 50, 75) */}
            {[25, 50, 75].map((level) => {
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
                    x={paddingX - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="#273229"
                    className="font-mono font-medium"
                  >
                    {level}
                  </text>
                </g>
              );
            })}

            {/* Soft Area fill (only when minimum-N is met) */}
            {minimumNMet && areaPath && <path d={areaPath} fill="url(#calmAreaGradient)" />}

            {/* Main Trend Line (only when minimum-N is met) */}
            {minimumNMet && linePath && (
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
              const hasData = d.checkinCount > 0;

              return (
                <g key={d.date} className="cursor-pointer">
                  <circle
                    cx={cx}
                    cy={cy}
                    r="14"
                    fill="transparent"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {hasData && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4}
                      fill="#FFFFFF"
                      stroke="#5B7563"
                      strokeWidth={isHovered ? '3' : '2'}
                      className="transition-all duration-150"
                    />
                  )}
                  {(range === '7d' || i % 4 === 0 || i === data.length - 1) && (
                    <text
                      x={cx}
                      y={height - 8}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#273229"
                      className="font-sans font-medium"
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
          <div className="absolute top-2 right-4 bg-surfaceLowest border border-outline-variant p-3 rounded-xl shadow-resting text-sm space-y-1 pointer-events-none">
            <p className="font-bold text-primary-dark">Stress: {Math.round(hoveredPoint.score)} / 100</p>
            <p className="text-stone-700">{hoveredPoint.date}</p>
            <p className="text-stone-700 font-medium">
              {hoveredPoint.checkinCount > 0
                ? `${hoveredPoint.checkinCount} check-in(s)`
                : 'No check-in recorded'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 text-sm text-stone-700 pt-1">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span>
          Lower scores reflect calm. All calculations are encrypted locally or securely processed.
        </span>
      </div>
    </section>
  );
};
