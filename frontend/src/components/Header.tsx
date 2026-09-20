import React from 'react';
import { Leaf, HeartHandshake, Wind } from 'lucide-react';

export type NavTab = 'dashboard' | 'relief-library' | 'trends-baseline' | 'settings';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenCrisis: () => void;
  onQuickRelief: () => void;
  onOpenCheckin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenCrisis,
  onQuickRelief,
  onOpenCheckin,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <header className="w-full sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant shadow-resting">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand and Status */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary-dark shadow-sm">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-headline text-xl font-bold tracking-tight text-primary-dark">
                Sanctuary
              </span>
              <span className="text-sm text-stone-700 font-normal">•</span>
              <span className="text-sm text-stone-700 font-semibold tracking-wide">
                Mindful Living
              </span>
            </div>
            <p className="text-sm text-stone-700 hidden sm:block font-medium">
              {currentDate} • {timeOfDay}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant">
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'bg-surfaceLowest text-primary-dark shadow-sm'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onTabChange('relief-library')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'relief-library'
                ? 'bg-surfaceLowest text-primary-dark shadow-sm'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            Stress Relief
          </button>
          <button
            type="button"
            onClick={() => onTabChange('trends-baseline')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'trends-baseline'
                ? 'bg-surfaceLowest text-primary-dark shadow-sm'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            Trends &amp; Baseline
          </button>
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'settings'
                ? 'bg-surfaceLowest text-primary-dark shadow-sm'
                : 'text-stone-700 hover:text-primary-dark'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center space-x-3">
          {/* Quick Relief Button */}
          <button
            type="button"
            onClick={onQuickRelief}
            aria-label="Start instant relief exercise"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-secondary-container text-primary-dark font-semibold text-sm hover:bg-secondary-container/80 transition-all border border-outline-variant"
          >
            <Wind className="w-4 h-4 text-primary" />
            <span>Relief Now</span>
          </button>

          {/* Emergency Support Trigger */}
          <button
            type="button"
            onClick={onOpenCrisis}
            aria-label="Access crisis helplines and immediate support"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-terracotta-container text-terracotta-dark text-sm font-semibold border border-terracotta/40 hover:bg-terracotta hover:text-white transition-colors duration-200"
          >
            <HeartHandshake className="w-4 h-4" />
            <span>Immediate Support</span>
          </button>
        </div>
      </div>
    </header>
  );
};
