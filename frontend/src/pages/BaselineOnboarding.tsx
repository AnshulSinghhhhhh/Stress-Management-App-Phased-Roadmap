import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { BaselineProfile } from '../api/types';
import { CheckCircle2, ArrowRight, ArrowLeft, Shield, Sparkles, RefreshCw } from 'lucide-react';

interface QuestionItem {
  id: string;
  prompt: string;
  subtext: string;
  options: string[];
}

const BASELINE_QUESTIONS: QuestionItem[] = [
  {
    id: 'physical_manifestation',
    prompt: 'How does stress typically show up in your physical body?',
    subtext: 'Noticing bodily signals early is the cornerstone of gentle regulation.',
    options: [
      'Tightness in shoulders & neck',
      'Shallow chest breathing',
      'Clenched jaw or furrowed brow',
      'Stomach knots or digestive tension',
      'General heavy fatigue & low energy',
    ],
  },
  {
    id: 'sleep_quality',
    prompt: 'How would you describe your natural sleep pattern lately?',
    subtext: 'Sleep and nervous system balance are deeply interconnected.',
    options: [
      'Generally sound and restorative',
      'Racing mind when trying to fall asleep',
      'Waking up frequently throughout the night',
      'Waking up tired even after 8 hours',
      'Irregular hours and light restless rest',
    ],
  },
  {
    id: 'daily_support',
    prompt: 'What usually offers you the most reliable sense of grounding?',
    subtext: 'We honor what already works for you.',
    options: [
      'Quiet solitary walk or movement',
      'Unstructured breathing and stillness',
      'Talking with a trusted friend or partner',
      'Listening to calming ambient sound or music',
      'Writing or journaling thoughts down',
    ],
  },
  {
    id: 'peak_hours',
    prompt: 'When during the day does mental strain tend to accumulate most?',
    subtext: 'Helps Sanctuary offer gentle check-in suggestions at the right time.',
    options: [
      'Morning arrival and planning (8 AM - 11 AM)',
      'Mid-afternoon energy drop (2 PM - 5 PM)',
      'Late evening wind-down (8 PM - 11 PM)',
      'Unpredictable, shifting from day to day',
    ],
  },
  {
    id: 'welcome_technique',
    prompt: 'What style of intervention feels most restful for you?',
    subtext: 'Every nervous system responds differently.',
    options: [
      '4-4-4-4 Box Breathing (Paced physiological reset)',
      '5-4-3-2-1 Sensory Grounding (Physical room re-orientation)',
      '3-Minute Somatic Pause (Progressive muscular release)',
      'Silent unguided timer with soft bell',
    ],
  },
];

interface BaselineOnboardingProps {
  onComplete?: () => void;
}

export const BaselineOnboarding: React.FC<BaselineOnboardingProps> = ({ onComplete }) => {
  const [profile, setProfile] = useState<BaselineProfile | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    apiClient.getBaseline().then((res) => {
      setProfile(res);
      if (res.completed && res.answers) {
        setAnswers(res.answers);
        setIsDone(true);
      }
    });
  }, []);

  const currentQ = BASELINE_QUESTIONS[currentIndex];
  const selectedOption = answers[currentQ?.id] || '';

  const handleSelectOption = (option: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: option }));
  };

  const handleNext = async () => {
    if (currentIndex < BASELINE_QUESTIONS.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Final submission
      setIsSaving(true);
      try {
        const saved = await apiClient.saveBaseline(answers);
        setProfile(saved);
        setIsDone(true);
        if (onComplete) onComplete();
      } catch (err) {
        console.error('Failed to save baseline:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleRetake = () => {
    setIsDone(false);
    setCurrentIndex(0);
  };

  if (isDone) {
    return (
      <div className="w-full max-w-[720px] mx-auto p-6 sm:p-8 bg-surfaceLowest border border-outline-variant rounded-3xl shadow-resting space-y-6">
        <div className="flex items-center space-x-3 text-primary">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-medium text-on-surface">
              Baseline Profile Active
            </h2>
            <p className="text-xs text-on-surface-variant">
              Encrypted &amp; calibrated for your personal nervous system baseline.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {BASELINE_QUESTIONS.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <span className="text-xs text-outline font-medium">{q.prompt}</span>
                <p className="text-sm font-semibold text-primary">
                  {answers[q.id] || 'Not specified'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-outline-variant/60">
          <span className="text-xs text-on-surface-variant flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span>Never shared with advertisers or third parties.</span>
          </span>
          <button
            type="button"
            onClick={handleRetake}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-surface-container text-on-surface hover:bg-surface-container/80 transition-colors text-xs font-medium border border-outline-variant"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Update Baseline Answers</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[720px] mx-auto p-6 sm:p-8 bg-surfaceLowest border border-outline-variant rounded-3xl shadow-resting space-y-6">
      {/* Progress Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-secondary-container/60 text-primary text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Sanctuary Baseline Onboarding</span>
          </div>
          <span className="text-xs font-medium text-outline">
            Question {currentIndex + 1} of {BASELINE_QUESTIONS.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / BASELINE_QUESTIONS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question Prompt */}
      <div className="space-y-2 pt-2">
        <h2 className="font-headline text-2xl font-medium text-on-surface tracking-tight">
          {currentQ.prompt}
        </h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {currentQ.subtext}
        </p>
      </div>

      {/* Options List */}
      <div className="space-y-2.5 pt-1">
        {currentQ.options.map((opt) => {
          const isSelected = selectedOption === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelectOption(opt)}
              className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                isSelected
                  ? 'bg-secondary-container/70 border-primary text-on-surface shadow-xs'
                  : 'bg-surfaceLowest border-outline-variant hover:border-primary hover:bg-surface-container-low text-on-surface'
              }`}
            >
              <span className="text-sm font-medium">{opt}</span>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                  isSelected ? 'border-primary bg-primary' : 'border-outline-variant'
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/60">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentIndex === 0}
          className={`inline-flex items-center space-x-1.5 text-xs font-medium px-4 py-2 rounded-full transition-colors ${
            currentIndex === 0
              ? 'opacity-0 pointer-events-none'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedOption || isSaving}
          className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-40"
        >
          <span>
            {currentIndex === BASELINE_QUESTIONS.length - 1
              ? isSaving
                ? 'Calibrating...'
                : 'Complete Baseline'
              : 'Next Question'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
