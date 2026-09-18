import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface MoodScaleProps {
  value: number; // 1 to 10
  onChange: (value: number) => void;
}

export const MoodScale: React.FC<MoodScaleProps> = ({ value, onChange }) => {
  const getMoodDescriptor = (val: number) => {
    if (val <= 3) {
      return {
        category: 'Depleted / High Stress',
        subtext: 'Holding tension • Gentle breath recommended',
        accent: 'text-terracotta',
        bgPill: 'bg-terracotta-container/60',
      };
    }
    if (val <= 7) {
      return {
        category: 'Steady / Centered',
        subtext: 'Centered rhythm • Balanced presence',
        accent: 'text-primary',
        bgPill: 'bg-secondary-container/60',
      };
    }
    return {
      category: 'Radiant / Thriving',
      subtext: 'Expansive ease • Deep restorative space',
      accent: 'text-primary',
      bgPill: 'bg-secondary-container',
    };
  };

  const descriptor = getMoodDescriptor(value);

  return (
    <section className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 shadow-resting transition-all duration-200 space-y-6">
      {/* Header Display with Active Mood */}
      <div className="flex items-center justify-between border-b border-outline-variant/40 pb-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline text-xl font-semibold shadow-sm transition-transform duration-200">
            {value}
          </div>
          <div>
            <h2 className="font-headline text-lg text-on-surface font-medium tracking-tight">
              {descriptor.category}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {descriptor.subtext}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-primary text-xs font-medium bg-secondary-container/50 px-3 py-1 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          <span>Takes 15 seconds</span>
        </div>
      </div>

      {/* Tactile 1–10 Step Buttons */}
      <div className="space-y-4">
        <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider">
          Select your current energy level
        </label>
        <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((step) => {
            const isActive = step === value;
            return (
              <button
                key={step}
                type="button"
                onClick={() => onChange(step)}
                aria-label={`Mood rating ${step} of 10`}
                className={`aspect-square flex flex-col items-center justify-center rounded-full text-sm sm:text-base font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white shadow-md ring-4 ring-secondary-container scale-110 z-10'
                    : 'bg-surface border border-outline-variant text-on-surface-variant hover:border-primary hover:text-on-surface hover:scale-105 active:scale-95'
                }`}
              >
                {step}
              </button>
            );
          })}
        </div>

        {/* Fluid Tactile Range Slider */}
        <div className="pt-2 px-1">
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="Fine-tune mood rating"
            className="w-full h-2 bg-surface-container rounded-full appearance-none cursor-pointer accent-primary focus:outline-none"
          />
        </div>

        {/* Qualitative Anchors */}
        <div className="flex justify-between items-center px-1 text-xs text-on-surface-variant pt-1">
          <span className="text-terracotta font-medium">1: Depleted / High Stress</span>
          <span className="hidden sm:inline-block text-outline font-normal">5: Steady / Centered</span>
          <span className="text-primary font-medium">10: Radiant / Thriving</span>
        </div>
      </div>
    </section>
  );
};
