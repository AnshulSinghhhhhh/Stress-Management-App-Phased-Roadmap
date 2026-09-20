import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedMoodCharacter } from './AnimatedMoodCharacter';
import { PaperTape } from './DoodleIcons';
import { SCALE_CONVENTION } from '../utils/moodScale';

interface MoodScaleProps {
  value: number; // 1 to 10
  onChange: (value: number) => void;
}

export const MoodScale: React.FC<MoodScaleProps> = ({ value, onChange }) => {
  return (
    <section
      className="relative bg-paper-card border-2 border-stone-800 rounded-3xl p-5 sm:p-6 shadow-notebook space-y-5 select-none"
      data-testid="mood-scale-component"
    >
      {/* Decorative Washi Tape Accent at Top */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
        <PaperTape angle={-1} color="rgba(254, 243, 199, 0.9)" />
      </div>

      {/* Illustrated Animated Character & Single Source of Truth Descriptor */}
      <AnimatedMoodCharacter value={value} />

      {/* Tactile 1–10 Interactive Step Pills */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-sm font-semibold text-stone-700 uppercase tracking-wider font-body">
            Select Rating (1 to 10)
          </label>
          <span className="text-sm font-handwriting font-bold text-primary-dark">
            {SCALE_CONVENTION.INLINE_CAPTION}
          </span>
        </div>

        <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((step) => {
            const isActive = step === value;
            return (
              <motion.button
                key={step}
                type="button"
                data-rating={step}
                data-testid={`mood-rating-btn-${step}`}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onChange(step)}
                aria-label={`Mood rating ${step} of 10`}
                className={`aspect-square flex items-center justify-center rounded-2xl text-sm sm:text-base font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-white border-2 border-stone-800 shadow-notebook ring-2 ring-primary/20 scale-105 z-10'
                    : 'bg-paper border border-stone-800/40 text-stone-700 hover:border-stone-800 hover:bg-paper-light'
                }`}
              >
                {step}
              </motion.button>
            );
          })}
        </div>

        {/* Range Slider for Fluid Dragging */}
        <div className="pt-2 px-1">
          <input
            type="range"
            min={SCALE_CONVENTION.MIN_VALUE}
            max={SCALE_CONVENTION.MAX_VALUE}
            step="1"
            value={value}
            data-testid="mood-slider-input"
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="Fine-tune mood rating"
            className="w-full h-2.5 bg-paper-yellow/60 border border-stone-800/40 rounded-full appearance-none cursor-pointer accent-primary focus:outline-none"
          />
        </div>

        {/* Qualitative Anchors (Unified 1=Highest Tension, 10=Most Calm) */}
        <div className="flex justify-between items-center px-1 text-sm font-body pt-1 font-medium">
          <span className="text-terracotta-dark font-bold">
            1: {SCALE_CONVENTION.MIN_LABEL}
          </span>
          <span className="text-stone-700 font-semibold hidden sm:inline-block">
            5: {SCALE_CONVENTION.MID_LABEL}
          </span>
          <span className="text-primary-dark font-bold">
            10: {SCALE_CONVENTION.MAX_LABEL}
          </span>
        </div>
      </div>
    </section>
  );
};
