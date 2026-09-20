import React, { useState } from 'react';
import { StressChart } from '../components/StressChart';
import { CalibratedIndicatorCard } from '../components/CalibratedIndicatorCard';
import { BaselineOnboarding } from './BaselineOnboarding';
import { Activity, ShieldCheck, Heart } from 'lucide-react';

interface TrendsBaselinePageProps {
  onTriggerRelief?: (techniqueId?: string) => void;
}

export const TrendsBaselinePage: React.FC<TrendsBaselinePageProps> = ({ onTriggerRelief }) => {
  const [activeSubView, setActiveSubView] = useState<'trends' | 'baseline'>('trends');

  return (
    <div className="w-full max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-8 animate-fade-in">
      {/* Subnav Pill Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl text-on-surface font-semibold tracking-tight">
            Trends &amp; Baseline
          </h1>
          <p className="text-sm text-stone-700">
            Longitudinal self-awareness without competitive scoring or streak pressure.
          </p>
        </div>

        <div className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubView('trends')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeSubView === 'trends'
                ? 'bg-surfaceLowest text-primary-dark shadow-xs'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Stress Trends</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('baseline')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeSubView === 'baseline'
                ? 'bg-surfaceLowest text-primary-dark shadow-xs'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Baseline Profile</span>
          </button>
        </div>
      </div>

      {/* Main View Content */}
      {activeSubView === 'trends' ? (
        <div className="space-y-6">
          <CalibratedIndicatorCard onTriggerAction={onTriggerRelief} />
          <StressChart />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-5 shadow-resting space-y-2">
              <div className="flex items-center space-x-2 text-primary-dark">
                <Heart className="w-5 h-5 text-primary" />
                <h3 className="font-headline text-base font-bold text-on-surface">
                  Why unhurried trends matter
                </h3>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed">
                Traditional trackers reward constant logging, creating pressure when a day is missed. Sanctuary views missed check-ins simply as moments of presence outside digital tools.
              </p>
            </div>

            <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-5 shadow-resting space-y-2">
              <div className="flex items-center space-x-2 text-primary-dark">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="font-headline text-base font-bold text-on-surface">
                  Data Sovereignty
                </h3>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed">
                Your stress calculations are processed locally or through secure endpoints. You can export the raw calculations or delete all history at any time in Settings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <BaselineOnboarding />
      )}
    </div>
  );
};
