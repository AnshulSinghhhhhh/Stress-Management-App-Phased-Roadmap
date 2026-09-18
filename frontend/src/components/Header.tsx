import React from 'react';
import { Leaf, HeartHandshake, ShieldAlert, Sparkles } from 'lucide-react';

export type NavTab = 'daily-pause' | 'relief-library' | 'trends-baseline' | 'settings';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenCrisis: () => void;
  onQuickRelief: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenCrisis,
  onQuickRelief,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <header className="w-full sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant shadow-resting">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand and Serene Status */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-primary shadow-sm">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-headline text-lg font-semibold tracking-tight text-primary">
                Sanctuary
              </span>
              <span className="text-xs text-outline-variant font-light">•</span>
              <span className="text-xs text-on-surface-variant font-medium tracking-wide">
                Serene Mindful Living
              </span>
            </div>
            <p className="text-xs text-on-surface-variant/80 hidden sm:block">
              {currentDate} • {timeOfDay} Pause
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant">
          <button
            type="button"
            onClick={() => onTabChange('daily-pause')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'daily-pause'
                ? 'bg-surfaceLowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Daily Pause
          </button>
          <button
            type="button"
            onClick={() => onTabChange('relief-library')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'relief-library'
                ? 'bg-surfaceLowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Stress Relief
          </button>
          <button
            type="button"
            onClick={() => onTabChange('trends-baseline')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'trends-baseline'
                ? 'bg-surfaceLowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Trends &amp; Baseline
          </button>
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'settings'
                ? 'bg-surfaceLowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Quick Relief Button */}
          <button
            type="button"
            onClick={onQuickRelief}
            aria-label="Start instant relief exercise"
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-secondary-container text-primary font-medium text-xs hover:bg-secondary-container/80 transition-all active:scale-[0.98] border border-outline-variant"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Relief Now</span>
          </button>

          {/* Serene Terracotta Emergency Support Trigger */}
          <button
            type="button"
            onClick={onOpenCrisis}
            aria-label="Access crisis helplines and immediate support"
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-terracotta-container text-terracotta text-xs font-medium border border-terracotta/30 hover:bg-terracotta hover:text-white transition-colors duration-200 active:scale-[0.98]"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Immediate Support</span>
          </button>
        </div>
      </div>
    </header>
  );
};
