import React, { useState, useEffect, useRef } from 'react';
import { MoodScale } from '../components/MoodScale';
import { EmotionalTags } from '../components/EmotionalTags';
import { VoiceNoteInput } from '../components/VoiceNoteInput';
import {
  CheckinPayload,
  CheckinResponse,
  CrisisResponse,
  TriggerCategory,
  PacingStatus,
  CheckinType,
} from '../api/types';
import { apiClient } from '../api/client';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  History,
  CheckCircle2,
  Briefcase,
  DollarSign,
  HeartHandshake,
  Activity,
  Users,
  Compass,
  Check,
} from 'lucide-react';

interface CheckinPageProps {
  onTriggerRelief: (techniqueId?: string) => void;
  onTriggerCrisisModal: (crisisData?: CrisisResponse | null) => void;
}

interface TriggerCategoryOption {
  id: TriggerCategory;
  label: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PINNED_TRIGGER_CATEGORIES: TriggerCategoryOption[] = [
  {
    id: 'work',
    label: 'Work & Career',
    subtext: 'Deadlines, workload, career pressure',
    icon: Briefcase,
  },
  {
    id: 'financial',
    label: 'Finances & Money',
    subtext: 'Expenses, budgeting, income worry',
    icon: DollarSign,
  },
  {
    id: 'relationship',
    label: 'Relationships & Family',
    subtext: 'Partner, family, friends, friction',
    icon: HeartHandshake,
  },
  {
    id: 'health',
    label: 'Health & Body',
    subtext: 'Physical body, fatigue, chronic pain',
    icon: Activity,
  },
  {
    id: 'sleep',
    label: 'Sleep & Rest',
    subtext: 'Insomnia, disrupted rest, exhaustion',
    icon: Moon,
  },
  {
    id: 'social_loneliness',
    label: 'Social & Loneliness',
    subtext: 'Isolation, social battery, disconnect',
    icon: Users,
  },
  {
    id: 'identity',
    label: 'Identity & Purpose',
    subtext: 'Self-doubt, purpose, life direction',
    icon: Compass,
  },
];

export const CheckinPage: React.FC<CheckinPageProps> = ({
  onTriggerRelief,
  onTriggerCrisisModal,
}) => {
  // Step sequence management (reusing onboarding step pattern)
  const [currentStep, setCurrentStep] = useState(0);

  // Time-of-day adaptive depth (§1.1): morning/afternoon/night is 2 steps, evening is 3 steps
  const [checkinType, setCheckinType] = useState<CheckinType>(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  });

  const totalSteps = checkinType === 'evening' ? 3 : 2;

  // Checkin inputs
  const [moodScore, setMoodScore] = useState<number>(7);
  const [selectedTriggerCategory, setSelectedTriggerCategory] = useState<TriggerCategory | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Calm']);
  const [freeText, setFreeText] = useState<string>('');

  // Pacing status & Soft branch
  const [pacingStatus, setPacingStatus] = useState<PacingStatus | null>(null);
  const [dismissPacingAdvisory, setDismissPacingAdvisory] = useState(false);

  // Submission & state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [recentCheckins, setRecentCheckins] = useState<CheckinResponse[]>([]);
  const [todayLatestScore, setTodayLatestScore] = useState<number | null>(null);

  useEffect(() => {
    loadRecentCheckins();
    checkPacing();
  }, []);

  const checkPacing = async () => {
    try {
      const status = await apiClient.getPacingStatus();
      setPacingStatus(status);
    } catch {
      // Non-blocking
    }
  };

  const loadRecentCheckins = async () => {
    const list = await apiClient.getRecentCheckins();
    setRecentCheckins(list);
    if (list.length > 0) {
      setTodayLatestScore(list[0].derived_stress_score ?? list[0].stress_score);
    }
  };

  const handleToggleTriggerCategory = (catId: TriggerCategory) => {
    setSelectedTriggerCategory((prev) => (prev === catId ? null : catId));
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSubmitCheckin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // Strict submission lock: prevent double-clicks during transit AND while success toast is displayed
    if (isSubmittingRef.current || isSubmitting || submissionSuccess) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmissionSuccess(false);

    const payload: CheckinPayload = {
      type: checkinType,
      mood_score: moodScore,
      tags: selectedTags,
      free_text: freeText.trim() || undefined,
      trigger_category: selectedTriggerCategory || undefined,
    };

    try {
      const response = await apiClient.submitCheckin(payload);

      // Check for crisis trigger immediately (non-delayed safety per SOP §6)
      if (response.crisis_detected) {
        onTriggerCrisisModal(response.crisis_payload);
      }

      setSubmissionSuccess(true);
      await loadRecentCheckins();

      // Reset step sequence after brief success display
      setTimeout(() => {
        setSubmissionSuccess(false);
        setCurrentStep(0);
        setFreeText('');
        setSelectedTriggerCategory(null);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }, 3000);
    } catch (err) {
      console.error('Check-in error:', err);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Prominent Manual "I need relief right now" Quick Trigger
  const handleManualReliefTrigger = async () => {
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const manualPayload: CheckinPayload = {
      type: 'manual',
      mood_score: Math.min(moodScore, 4),
      tags: [...selectedTags, 'Overwhelmed'],
      free_text: freeText || 'Manual relief trigger requested.',
      trigger_category: selectedTriggerCategory || undefined,
    };

    try {
      const response = await apiClient.submitCheckin(manualPayload);
      if (response.crisis_detected) {
        onTriggerCrisisModal(response.crisis_payload);
      } else {
        // Direct launch to 4-4-4-4 breathing
        onTriggerRelief('square_breathing');
      }
      await loadRecentCheckins();
    } catch (err) {
      console.error('Manual relief error:', err);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[760px] mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Soft Branch Pacing Guidance (§6.0) */}
      {pacingStatus?.soft_branch_recommended && !dismissPacingAdvisory && (
        <div className="w-full p-4 sm:p-5 rounded-2xl bg-surfaceLowest border border-[#A36B5E]/30 shadow-resting flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <HeartHandshake className="w-4 h-4 text-[#A36B5E]" />
              <h3 className="font-headline text-sm font-semibold text-on-surface">
                Gentle Check-in Pause
              </h3>
            </div>
            <p className="text-sm text-stone-700 max-w-xl">
              {pacingStatus.advisory_copy ||
                `You checked in ${pacingStatus.minutes_ago} minutes ago. Would you prefer a gentle 2-minute grounding reset instead?`}
            </p>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onTriggerRelief('grounding_54321')}
              className="px-4 py-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-all shadow-xs"
            >
              Try Grounding
            </button>
            <button
              type="button"
              onClick={() => setDismissPacingAdvisory(true)}
              className="px-4 py-2 rounded-full border border-outline-variant text-stone-700 hover:text-on-surface text-sm font-medium transition-all"
            >
              Continue to Log
            </button>
          </div>
        </div>
      )}

      {/* Top Hero Banner */}
      <div className="relative flex flex-col items-center text-center space-y-3 pt-2">
        {/* Soft Ambient Calm Glow */}
        <div className="absolute -top-6 w-36 h-36 rounded-full bg-secondary-container/70 blur-3xl opacity-50 pointer-events-none" />

        {/* Time-of-Day Adaptive Mode Toggle */}
        <div className="inline-flex flex-wrap items-center justify-center p-1.5 rounded-2xl sm:rounded-full bg-surface-container-low border border-outline-variant shadow-xs text-sm gap-1.5">
          {[
            { type: 'morning' as const, label: 'Morning', icon: Sunrise, steps: 2 },
            { type: 'afternoon' as const, label: 'Afternoon', icon: Sun, steps: 2 },
            { type: 'evening' as const, label: 'Evening', icon: Sunset, steps: 3 },
            { type: 'night' as const, label: 'Night', icon: Moon, steps: 2 },
          ].map((item) => {
            const Icon = item.icon;
            const isSel = checkinType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => {
                  setCheckinType(item.type);
                  if (item.steps === 2 && currentStep >= 2) setCurrentStep(1);
                }}
                className={`px-4 py-1.5 rounded-full font-semibold text-sm transition-all inline-flex items-center space-x-2 ${
                  isSel
                    ? 'bg-secondary-container text-primary-dark shadow-xs'
                    : 'text-stone-700 hover:text-on-surface'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label} ({item.steps} steps)</span>
              </button>
            );
          })}
        </div>

        <h1 className="font-headline text-3xl md:text-4xl text-on-surface font-semibold tracking-tight capitalize">
          {checkinType === 'morning'
            ? 'Gentle morning pause'
            : checkinType === 'afternoon'
            ? 'Midday grounding'
            : checkinType === 'evening'
            ? 'Evening reflection'
            : 'Night wind-down'}
        </h1>
        <p className="text-sm md:text-base text-stone-700 max-w-md">
          {checkinType === 'morning'
            ? 'A 15-second guided check on your energy and focus.'
            : checkinType === 'afternoon'
            ? 'A gentle pause to recalibrate your daytime energy.'
            : checkinType === 'evening'
            ? 'Unwind your thoughts and untangle the day before rest.'
            : 'Settle down your nervous system into restorative sleep.'}
        </p>

        {/* Today's Stress Status Badge */}
        {todayLatestScore !== null && (
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-surface-container-low border border-outline-variant text-sm text-stone-700">
            <span>Latest Stress Index:</span>
            <span className="font-bold text-primary-dark">{todayLatestScore} / 100</span>
            <span className="text-stone-700">• Steady</span>
          </div>
        )}
      </div>

      {/* Quick Relief Manual Emergency Trigger Card */}
      <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-resting">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start space-x-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-headline text-base font-semibold text-on-surface">
              Feeling tension right now?
            </h2>
          </div>
          <p className="text-sm text-stone-700">
            Jump directly into a 4-minute calming exercise without filing out a form.
          </p>
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleManualReliefTrigger}
          className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-secondary-container text-primary-dark font-semibold text-sm hover:bg-secondary-container/80 transition-all duration-200 border border-outline-variant inline-flex items-center justify-center space-x-2 shadow-xs active:scale-95 disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span>I need relief right now</span>
        </button>
      </div>

      {/* Main Multi-Step Checkin Card */}
      <div className="w-full bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-resting space-y-6 transition-all duration-300">
        {/* Step Progress Header */}
        <div className="space-y-3 border-b border-outline-variant/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-secondary-container/60 text-primary-dark text-sm font-semibold">
              {checkinType === 'morning' ? (
                <Sunrise className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              <span>
                {checkinType === 'morning' ? 'Morning rhythm' : 'Evening reflection'}
              </span>
            </div>
            <span className="text-sm font-medium text-stone-700">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${((currentStep + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* STEP 0: Mood Scale (1–10) */}
        {currentStep === 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-1">
              <h2 className="font-headline text-2xl font-medium text-on-surface tracking-tight">
                {checkinType === 'morning'
                  ? 'How does this morning feel?'
                  : 'How does this moment feel?'}
              </h2>
              <p className="text-sm text-on-surface-variant">
                Select your energy level. Takes under 5 seconds.
              </p>
            </div>

            <MoodScale value={moodScore} onChange={setMoodScore} />
          </div>
        )}

        {/* STEP 1: Contributing Factors & 7 Pinned Trigger Categories */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-1">
              <h2 className="font-headline text-2xl font-medium text-on-surface tracking-tight">
                {checkinType === 'morning'
                  ? "What's in your sphere this morning?"
                  : 'What shaped your stress or peace today?'}
              </h2>
              <p className="text-sm text-on-surface-variant">
                Tap any core category below. One tap logs directly into your root-cause insights.
              </p>
            </div>

            {/* 7 Pinned Trigger Categories (§2.0) One-Tap Chips */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-stone-700 uppercase tracking-wider">
                Trigger Categories (§2.0 Taxonomy)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PINNED_TRIGGER_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedTriggerCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleToggleTriggerCategory(cat.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-start space-x-3 ${
                        isSelected
                          ? 'bg-secondary-container/80 border-primary text-primary shadow-xs ring-2 ring-primary/20'
                          : 'bg-surfaceLowest border-outline-variant hover:border-primary/60 hover:bg-surface-container-low text-on-surface'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-surface-container text-stone-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium leading-tight">
                            {cat.label}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-sm flex-shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-stone-700 truncate mt-0.5">
                          {cat.subtext}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emotional Texture Tags (Optional) */}
            <div className="pt-2">
              <EmotionalTags
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
              />
            </div>
          </div>
        )}

        {/* STEP 2 (Evening Only): Reflective Prompt ("What's one thing that stayed with you today?") */}
        {currentStep === 2 && checkinType === 'evening' && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-1">
              <h2 className="font-headline text-2xl font-medium text-on-surface tracking-tight">
                What's one thing that stayed with you today?
              </h2>
              <p className="text-sm text-stone-700">
                A gentle moment of reflection before rest. Optional words or a voice note for yourself.
              </p>
            </div>

            <VoiceNoteInput
              value={freeText}
              onChange={setFreeText}
              title="What's one thing that stayed with you today?"
              subtitle="Speak or type unhurriedly. Saved purely for your own peace."
              placeholder="What's one thing that stayed with you today? (optional)"
            />
          </div>
        )}

        {/* Submission Feedback Toast */}
        {submissionSuccess && (
          <div className="w-full p-4 rounded-2xl bg-secondary-container/90 text-primary border border-primary/20 flex items-center justify-center space-x-2 text-sm font-medium animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
            <span>Check-in saved peacefully. Your rhythm is logged.</span>
          </div>
        )}

        {/* Step Navigation Footer Matching Onboarding Pattern */}
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/60">
          {/* Back Button */}
          {currentStep > 0 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handlePrevStep}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-outline-variant bg-surfaceLowest hover:bg-surface-container-low text-on-surface text-sm font-medium transition-colors disabled:opacity-60"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div className="text-sm text-stone-700 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Private &amp; local</span>
            </div>
          )}

          {/* Next or Complete Button */}
          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleNextStep}
              className="inline-flex items-center space-x-2 py-2.5 px-6 rounded-full bg-primary hover:bg-primary-dark text-white font-medium text-sm transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed"
            >
              <span>
                {currentStep === 0
                  ? 'Continue to contributing factors'
                  : 'Continue to reflection'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting || submissionSuccess}
              onClick={() => handleSubmitCheckin()}
              className="inline-flex items-center space-x-2 py-2.5 px-7 rounded-full bg-primary hover:bg-primary-dark text-white font-medium text-sm transition-all duration-200 shadow-md active:scale-95 disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed"
            >
              <span>
                {isSubmitting
                  ? 'Recording...'
                  : submissionSuccess
                  ? 'Check-in Recorded'
                  : `Complete ${typeof checkinType === 'string' ? checkinType.charAt(0).toUpperCase() + checkinType.slice(1) : ''} Check-in`}
              </span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Recent Check-in History */}
      {recentCheckins.length > 0 && (
        <section className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 shadow-resting space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-primary" />
              <h3 className="font-headline text-base font-medium text-on-surface">
                Recent Check-ins
              </h3>
            </div>
            <span className="text-sm text-stone-700">{recentCheckins.length} recorded</span>
          </div>

          <div className="divide-y divide-outline-variant/30">
            {recentCheckins.slice(0, 4).map((c) => {
              const timeStr = new Date(c.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });

              const displayStress = c.derived_stress_score ?? (c.stress_score <= 10 ? c.stress_score * 10 : c.stress_score);

              return (
                <div key={c.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-secondary-container text-primary flex items-center justify-center text-sm font-semibold">
                        {c.mood_score}
                      </span>
                      <span className="text-sm font-medium text-on-surface capitalize">
                        {c.type} check-in
                      </span>
                      <span className="text-sm text-stone-500">•</span>
                      <span className="text-sm text-stone-700">{timeStr}</span>
                    </div>

                    {c.free_text && (
                      <p className="text-sm text-stone-700 italic pl-8">
                        "{c.free_text}"
                      </p>
                    )}

                    {c.tags && c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-8 pt-0.5">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="text-sm px-2.5 py-0.5 rounded-full bg-surface-container text-stone-700 font-medium"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-sm text-stone-700">Stress</span>
                    <p className="text-sm font-semibold text-primary">{Math.round(displayStress)}/100</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
