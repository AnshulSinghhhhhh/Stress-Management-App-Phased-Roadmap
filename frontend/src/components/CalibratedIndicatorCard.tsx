import React, { useState, useEffect } from 'react';
import { CalibratedIndicator } from '../api/types';
import { apiClient } from '../api/client';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface CalibratedIndicatorCardProps {
  onTriggerAction?: (techniqueId: string) => void;
}

export const CalibratedIndicatorCard: React.FC<CalibratedIndicatorCardProps> = ({
  onTriggerAction,
}) => {
  const [indicator, setIndicator] = useState<CalibratedIndicator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiClient.getCalibratedIndicator().then((data) => {
      if (mounted) {
        setIndicator(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !indicator) {
    return (
      <div className="w-full p-6 bg-surfaceLowest border border-outline-variant rounded-2xl shadow-resting animate-pulse">
        <div className="h-4 bg-surface-container rounded w-1/3 mb-4" />
        <div className="h-8 bg-surface-container rounded w-1/4 mb-2" />
        <div className="h-4 bg-surface-container rounded w-2/3" />
      </div>
    );
  }

  const {
    current_score,
    confidence_score,
    effective_sample_size,
    distinct_days,
    minimum_n_met,
    status,
    trend_direction,
    trend_slope,
    status_copy,
    contributing_factors,
    recommended_action,
  } = indicator;

  const confidencePct = Math.round(confidence_score * 100);

  return (
    <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 sm:p-7 shadow-resting space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="font-headline text-lg sm:text-xl font-semibold text-on-surface">
              Calibrated Stress Indicator
            </h2>
          </div>
          <p className="text-sm text-stone-700">
            Recency-weighted moving average calibrated to your baseline
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-secondary-container text-primary-dark text-sm font-semibold self-start sm:self-auto capitalize">
          <span>{status} Baseline</span>
        </div>
      </div>

      {/* Main Score & Confidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calibrated Score */}
        <div className="p-4 rounded-xl bg-surface-container-low/80 border border-outline-variant flex flex-col justify-between">
          <span className="text-sm text-stone-700 font-semibold">Calibrated Stress Index</span>
          <div className="pt-3">
            <div className="flex items-baseline space-x-2">
              <span className="font-headline text-3xl font-bold text-primary-dark">
                {Math.round(current_score)}
              </span>
              <span className="text-sm text-stone-700 font-medium">/ 100</span>
            </div>
            <p className="text-sm text-stone-700 pt-1.5 font-medium">
              {current_score >= 65
                ? 'Elevated tension'
                : current_score >= 40
                ? 'Moderate balanced state'
                : 'Restorative calm'}
            </p>
          </div>
        </div>

        {/* Statistical Confidence & Distinct Days */}
        <div className="p-4 rounded-xl bg-surface-container-low/80 border border-outline-variant flex flex-col justify-between">
          <span className="text-sm text-stone-700 font-semibold">Confidence Level</span>
          <div className="pt-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-headline text-2xl font-bold text-on-surface">
                {confidencePct}%
              </span>
              <span className="text-sm text-stone-700 font-medium">
                N_eff = {effective_sample_size.toFixed(1)}
              </span>
            </div>
            {/* Confidence Bar */}
            <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <p className="text-sm text-stone-700">
              {distinct_days} distinct days logged
            </p>
          </div>
        </div>

        {/* Longitudinal Trajectory */}
        <div className="p-4 rounded-xl bg-surface-container-low/80 border border-outline-variant flex flex-col justify-between">
          <span className="text-sm text-stone-700 font-semibold">7-Day Trajectory</span>
          <div className="pt-3">
            {minimum_n_met ? (
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {trend_direction === 'rising' ? (
                    <TrendingUp className="w-5 h-5 text-terracotta-dark" />
                  ) : trend_direction === 'easing' ? (
                    <TrendingDown className="w-5 h-5 text-primary-dark" />
                  ) : (
                    <Minus className="w-5 h-5 text-stone-700" />
                  )}
                  <span className="font-headline text-base font-bold capitalize text-on-surface">
                    {trend_direction || 'Stable'}
                  </span>
                  {trend_slope ? (
                    <span className="text-sm text-stone-700 font-medium">
                      ({trend_slope > 0 ? '+' : ''}{trend_slope}/day)
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-stone-700">Minimum sample reached</p>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-sm text-stone-700 font-medium italic">
                  Calibrating baseline...
                </span>
                <p className="text-sm text-stone-700">
                  {status_copy}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deterministic Factor Attribution */}
      {contributing_factors && contributing_factors.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-base font-semibold text-on-surface flex items-center space-x-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>Contributing Factor Attribution</span>
            </h3>
            <span className="text-sm text-stone-700 font-medium">7-Category Taxonomy</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contributing_factors.map((factor) => (
              <div
                key={factor.category}
                className="p-4 rounded-xl bg-surface-container-low border border-outline-variant space-y-1.5"
                data-testid="factor-attribution-item"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface capitalize">
                    {factor.category.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-bold text-primary-dark">
                    {factor.contribution_pct}% impact
                  </span>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {factor.deterministic_reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Recommended Somatic Action */}
      {recommended_action && (
        <div className="p-4 sm:p-5 rounded-2xl bg-secondary-container/40 border border-primary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-bold text-primary-dark uppercase tracking-wider">
              Recommended Reset
            </span>
            <h4 className="font-headline text-base font-bold text-on-surface">
              {recommended_action.title}
            </h4>
            <p className="text-sm text-stone-700">
              {recommended_action.reason}
            </p>
          </div>

          {onTriggerAction && (
            <button
              type="button"
              onClick={() => onTriggerAction(recommended_action.technique)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-all shadow-xs flex-shrink-0"
            >
              <span>Begin Exercise</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
