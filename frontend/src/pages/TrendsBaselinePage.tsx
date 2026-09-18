import React, { useState } from 'react';
import { StressChart } from '../components/StressChart';
import { BaselineOnboarding } from './BaselineOnboarding';
import { Sparkles, Activity, ShieldCheck, Heart } from 'lucide-react';

export const TrendsBaselinePage: React.FC = () => {
  const [activeSubView, setActiveSubView] = useState<'trends' | 'baseline'>('trends');

  return (
    <div className="w-full max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Subnav Pill Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl text-on-surface font-medium tracking-tight">
            Trends &amp; Nervous System Baseline
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Longitudinal self-awareness without competitive scoring or pressure.
          </p>
        </div>

        <div className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubView('trends')}
            className={`inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeSubView === 'trends'
                ? 'bg-surfaceLowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Stress Trends</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('baseline')}
            className={`inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeSubView === 'baseline'
                ? 'bg-surfaceLowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Baseline Profile</span>
          </button>
        </div>
      </div>

      {/* Main View Content */}
      {activeSubView === 'trends' ? (
        <div className="space-y-6">
          <StressChart />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-5 shadow-resting space-y-2">
              <div className="flex items-center space-x-2 text-primary">
                <Heart className="w-4 h-4" />
                <h3 className="font-headline text-sm font-semibold">
                  Why unhurried trends matter
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Traditional trackers celebrate high volume and continuous streaks, creating anxiety when a day is skipped. Sanctuary views missing days simply as moments of presence outside digital tools.
              </p>
            </div>

            <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-5 shadow-resting space-y-2">
              <div className="flex items-center space-x-2 text-primary">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="font-headline text-sm font-semibold">
                  Data Sovereignty
                </h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Your stress calculations remain encrypted. You can export the raw calculations or wipe all history at any time from the Settings tab.
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
