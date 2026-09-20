import React, { useState, useEffect, useRef } from 'react';
import { MoodScale } from './MoodScale';
import { EmotionalTags } from './EmotionalTags';
import { VoiceNoteInput } from './VoiceNoteInput';
import {
  CheckinPayload,
  CrisisResponse,
  TriggerCategory,
  PacingStatus,
  CheckinType,
} from '../api/types';
import { apiClient } from '../api/client';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperTape, DoodleCheck, DoodleSquiggle } from './DoodleIcons';
import {
  X,
  ArrowRight,
  ShieldCheck,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  HeartHandshake,
  Briefcase,
  DollarSign,
  Activity,
  Users,
  Compass,
  Check,
  Lock,
  Plus,
} from 'lucide-react';

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onTriggerRelief: (techniqueId?: string) => void;
  onTriggerCrisisModal: (crisisData?: CrisisResponse | null) => void;
}

interface TriggerCategoryOption {
  id: TriggerCategory;
  label: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const LOCKED_TRIGGER_CATEGORIES: TriggerCategoryOption[] = [
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
    subtext: 'Disrupted rest, exhaustion, insomnia',
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

export const getAutoCircadianType = (): CheckinType => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
};

export const getCircadianMeta = (type: CheckinType) => {
  switch (type) {
    case 'morning':
      return {
        label: 'Morning Pause',
        icon: Sunrise,
        subtitle: 'A brief pause to check your morning energy and focus.',
        steps: 2,
      };
    case 'afternoon':
      return {
        label: 'Midday Pause',
        icon: Sun,
        subtitle: 'A quick midday check-in to reset and ground.',
        steps: 2,
      };
    case 'evening':
      return {
        label: 'Evening Reflection',
        icon: Sunset,
        subtitle: 'Unwind your thoughts and reflect on the day before rest.',
        steps: 3,
      };
    case 'night':
      return {
        label: 'Night Wind-down',
        icon: Moon,
        subtitle: 'A quiet pause before restorative sleep.',
        steps: 2,
      };
    default:
      return {
        label: 'Daily Pause',
        icon: Sun,
        subtitle: 'A moment to pause and listen to your body.',
        steps: 2,
      };
  }
};

export const CheckinModal: React.FC<CheckinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onTriggerRelief,
  onTriggerCrisisModal,
}) => {
  // Step sequence
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-derived circadian type from device clock (NEVER picked by user)
  const [checkinType, setCheckinType] = useState<CheckinType>(getAutoCircadianType);
  const circadianMeta = getCircadianMeta(checkinType);
  const totalSteps = circadianMeta.steps;

  // Form inputs
  const [moodScore, setMoodScore] = useState<number>(7);
  const [selectedTriggerCategories, setSelectedTriggerCategories] = useState<TriggerCategory[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Calm']);
  const [freeText, setFreeText] = useState<string>('');

  // Universal note affordance: collapsed by default on all check-ins (15s loop preserved)
  const [isNoteExpanded, setIsNoteExpanded] = useState<boolean>(false);

  // Suggested feeling tone from text classification (v2.2 Objective 2)
  const [detectedToneSuggestion, setDetectedToneSuggestion] = useState<{
    checkinId: string;
    feelings: string[];
    confidence?: number;
  } | null>(null);

  // Pacing status & soft branch
  const [pacingStatus, setPacingStatus] = useState<PacingStatus | null>(null);
  const [dismissPacingAdvisory, setDismissPacingAdvisory] = useState(false);

  // Submission lock
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Gentle celebration trigger (Anti-gamification: no streaks, pure mindful acknowledgement)
  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#5B7563', '#A36B5E', '#D3E8D7', '#FEF9C3', '#E5DECB'],
        disableForReducedMotion: true,
      });
    } catch {
      // Non-blocking
    }
  };

  // Update circadian type whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const derived = getAutoCircadianType();
      setCheckinType(derived);
      setCurrentStep(0);
      setSubmissionSuccess(false);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setIsNoteExpanded(false);
      setSelectedTriggerCategories([]);
      setDetectedToneSuggestion(null);
      setDismissPacingAdvisory(false);
      checkPacing();
    }
  }, [isOpen]);

  const checkPacing = async () => {
    try {
      const status = await apiClient.getPacingStatus();
      setPacingStatus(status);
    } catch {
      // Non-blocking
    }
  };

  if (!isOpen) return null;

  // v2.3 Bug Fix A1: Multi-select toggle
  const handleToggleTriggerCategory = (catId: TriggerCategory) => {
    setSelectedTriggerCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
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
      trigger_category: selectedTriggerCategories[0] || undefined,
      trigger_categories: selectedTriggerCategories,
    };

    try {
      const response = await apiClient.submitCheckin(payload);

      // Synchronous crisis detection
      if (response.crisis_detected) {
        onTriggerCrisisModal(response.crisis_payload);
      }

      onSuccess();

      // Check for feeling tone detection suggestion (v2.2 Objective 2)
      if (response.detected_feelings && response.detected_feelings.length > 0) {
        setDetectedToneSuggestion({
          checkinId: response.id,
          feelings: response.detected_feelings,
          confidence: response.detected_feelings_confidence,
        });
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      } else {
        triggerCelebration();
        setSubmissionSuccess(true);
        setTimeout(() => {
          setSubmissionSuccess(false);
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          onClose();
        }, 1600);
      }
    } catch (err) {
      console.error('Check-in submission failed:', err);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAcceptTone = async () => {
    if (!detectedToneSuggestion) return;
    try {
      await apiClient.updateCheckinFeelings(
        detectedToneSuggestion.checkinId,
        detectedToneSuggestion.feelings
      );
      onSuccess();
    } catch (err) {
      console.error('Failed to accept tone:', err);
    }
    setDetectedToneSuggestion(null);
    triggerCelebration();
    setSubmissionSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleEditTone = () => {
    if (detectedToneSuggestion) {
      setSelectedTags((prev) =>
        Array.from(new Set([...prev, ...detectedToneSuggestion.feelings]))
      );
    }
    setDetectedToneSuggestion(null);
    setCurrentStep(1);
  };

  const handleDismissTone = () => {
    setDetectedToneSuggestion(null);
    setSubmissionSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const CircadianIcon = circadianMeta.icon;
  const currentTimeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-stone-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-[660px] bg-[#FAF7F0] border-2 border-stone-800 rounded-3xl shadow-notebook-lg overflow-hidden my-auto"
        style={{ backgroundColor: '#FAF7F0' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Washi Tape Header Accent */}
        <div className="absolute -top-3.5 left-8 z-30 pointer-events-none">
          <PaperTape angle={-1.8} color="rgba(254, 240, 199, 0.95)" />
        </div>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b-2 border-stone-800/20 bg-[#FAF7F0] flex items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-secondary-container text-primary-dark text-sm font-semibold border border-stone-800/30 shadow-xs">
                <CircadianIcon className="w-4 h-4" />
                <span className="font-handwriting font-bold text-base">{circadianMeta.label}</span>
                <span className="opacity-50">•</span>
                <span>{currentTimeString}</span>
              </span>
              <span className="text-sm text-stone-700 hidden sm:inline font-medium">
                Auto-detected
              </span>
            </div>
            <h2 className="font-handwriting text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              {currentStep === 0
                ? 'How are you feeling right now?'
                : currentStep === 1
                ? 'Context & Emotional Tone'
                : 'Evening Reflection'}
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed font-body">
              {currentStep === 0
                ? 'Check in with your body and mind along the calm & tension scale.'
                : currentStep === 1
                ? 'Select any contributing life areas or emotional textures (multi-select).'
                : 'A quiet space to unload any remaining thoughts before rest.'}
            </p>
          </div>

          <button
            type="button"
            data-testid="close-checkin-modal-btn"
            onClick={onClose}
            className="p-2 rounded-full text-stone-700 hover:text-on-surface hover:bg-stone-200 transition-colors border border-transparent hover:border-stone-800/40"
            aria-label="Close check-in"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Soft Branch Pacing Guidance Banner */}
        {pacingStatus?.soft_branch_recommended && !dismissPacingAdvisory && (
          <div className="m-4 sm:mx-6 sm:mt-4 p-4 rounded-2xl bg-paper-rose border-2 border-terracotta/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm shadow-notebook">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-terracotta-dark font-bold font-handwriting text-base">
                <HeartHandshake className="w-4 h-4 shrink-0" />
                <span>Gentle Pacing Advisory</span>
              </div>
              <p className="text-stone-700 font-body">
                {pacingStatus.advisory_copy ||
                  `You checked in ${pacingStatus.minutes_ago} minutes ago. Would you like to try a 2-minute reset instead, or log what shifted?`}
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerRelief('grounding_54321');
                }}
                className="px-4 py-2 rounded-full bg-primary hover:bg-primary-dark text-white font-semibold transition-all text-sm border border-stone-800 shadow-notebook"
              >
                Try Grounding
              </button>
              <button
                type="button"
                onClick={() => setDismissPacingAdvisory(true)}
                className="px-3 py-2 rounded-full border border-stone-800/40 text-stone-700 hover:text-on-surface text-sm font-medium bg-paper-card"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Tone Detection Suggestion Banner (v2.2 Objective 2) */}
        {detectedToneSuggestion && (
          <div
            className="m-4 sm:mx-6 sm:mt-4 p-5 rounded-2xl bg-paper-mint border-2 border-primary/60 space-y-3 animate-fade-in shadow-notebook"
            data-testid="tone-suggestion-banner"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-on-surface">
                <span className="font-handwriting font-bold text-base text-primary-dark uppercase tracking-wider">
                  Detected tone:
                </span>
                <span className="text-lg font-bold font-handwriting text-on-surface">
                  {detectedToneSuggestion.feelings.join(', ')}
                </span>
                <span className="text-sm text-stone-700 font-medium">— does this match?</span>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed font-body">
                Accepting adds these feelings to your contributing factors attribution for this check-in without changing your calibrated stress formula.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={handleAcceptTone}
                data-testid="tone-accept-btn"
                className="px-5 py-2 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-bold transition-all border border-stone-800 shadow-notebook"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={handleEditTone}
                data-testid="tone-edit-btn"
                className="px-4 py-2 rounded-full border border-stone-800/50 bg-paper-card hover:bg-paper text-on-surface text-sm font-semibold transition-all"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDismissTone}
                data-testid="tone-dismiss-btn"
                className="px-4 py-2 rounded-full text-stone-700 hover:text-on-surface text-sm font-medium transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="px-6 pt-4 flex items-center space-x-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full flex-1 transition-all duration-300 border border-stone-800/30 ${
                idx === currentStep
                  ? 'bg-primary'
                  : idx < currentStep
                  ? 'bg-secondary-container'
                  : 'bg-stone-200'
              }`}
            />
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto bg-[#FAF7F0]" style={{ backgroundColor: '#FAF7F0' }}>
          {/* STEP 1: Mood Slider (1–10) with Single Source of Truth Animated Mood Scale */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold uppercase tracking-wider text-primary-dark font-handwriting text-base">
                  Step 1 of {totalSteps}: Rate Mind &amp; Body
                </span>
                <span className="text-sm text-stone-600 font-medium">
                  {circadianMeta.label}
                </span>
              </div>

              {/* Single Source of Truth MoodScale Component */}
              <MoodScale value={moodScore} onChange={setMoodScore} />
            </div>
          )}

          {/* STEP 2: Locked 7 Trigger Categories (Multi-Select) + Emotional Tags + Universal Note Affordance */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider text-primary-dark font-handwriting text-base">
                    Step 2 of {totalSteps}: Contributing Factors
                  </span>
                  <span className="text-sm text-stone-700 font-medium font-body">
                    Select all that apply (multi-select)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-handwriting text-xl font-bold text-on-surface">
                    Contributing Life Triggers
                  </h3>
                  {selectedTriggerCategories.length > 0 && (
                    <span className="text-sm font-handwriting font-bold text-primary-dark bg-secondary-container/80 px-2.5 py-0.5 rounded-full border border-stone-800/30">
                      {selectedTriggerCategories.length} selected
                    </span>
                  )}
                </div>

                {/* 7 Locked Trigger Categories — v2.3 Bug Fix A1 Multi-Select */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="trigger-categories-multi-grid">
                  {LOCKED_TRIGGER_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedTriggerCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggleTriggerCategory(cat.id)}
                        data-testid={`trigger-chip-${cat.id}`}
                        className={`p-3.5 rounded-2xl text-left border-2 transition-all flex items-start space-x-3.5 ${
                          isSelected
                            ? 'bg-secondary-container/80 border-stone-800 shadow-notebook ring-2 ring-primary/20 scale-[1.01]'
                            : 'bg-paper-card border-stone-800/40 hover:border-stone-800 hover:bg-paper hover:shadow-xs'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                            isSelected
                              ? 'bg-primary text-white border-stone-800'
                              : 'bg-paper text-stone-700 border-stone-800/30'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm font-bold block truncate font-body ${
                                isSelected ? 'text-primary-dark' : 'text-on-surface'
                              }`}
                            >
                              {cat.label}
                            </span>
                            {isSelected && (
                              <span className="text-primary shrink-0 ml-1">
                                <DoodleCheck className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-stone-700 block leading-snug font-body">
                            {cat.subtext}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Emotional Texture Tags */}
              <div className="space-y-3 pt-2 border-t border-outline-variant/60">
                <h3 className="font-headline text-base font-semibold text-on-surface">
                  Emotional Texture
                </h3>
                <EmotionalTags selectedTags={selectedTags} onToggleTag={handleToggleTag} />
              </div>

              {/* Universal Note & Voice Memo Affordance (v2.2 Objective 1) */}
              {/* Present on EVERY check-in (morning/afternoon/evening/night) — collapsed by default for 15s speed */}
              <div className="pt-3 border-t border-outline-variant/60 space-y-3" data-testid="checkin-note-affordance-container">
                {!isNoteExpanded && !freeText ? (
                  <button
                    type="button"
                    onClick={() => setIsNoteExpanded(true)}
                    data-testid="open-note-affordance-btn"
                    className="w-full py-3 px-4 rounded-2xl border border-dashed border-outline-variant hover:border-primary text-stone-700 hover:text-primary transition-all flex items-center justify-center space-x-2 text-sm font-semibold bg-surface-container-low/50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add a note or voice memo (optional)</span>
                  </button>
                ) : (
                  <div
                    className="space-y-3 bg-surface-container-low/70 p-4 rounded-2xl border border-outline-variant/80 animate-fade-in"
                    data-testid="note-affordance-expanded"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-on-surface">
                        Personal Note or Voice Reflection{' '}
                        <span className="text-stone-700 font-normal">(optional)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNoteExpanded(false)}
                        className="text-sm text-stone-700 hover:text-on-surface font-semibold"
                      >
                        Collapse
                      </button>
                    </div>
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="Type context, feelings, or thoughts here..."
                      rows={3}
                      className="w-full p-3.5 rounded-xl bg-surface border border-outline-variant focus:border-primary text-sm text-on-surface placeholder:text-stone-700 resize-none transition-all shadow-xs"
                      data-testid="checkin-note-textarea"
                    />
                    <VoiceNoteInput
                      value={freeText}
                      onChange={setFreeText}
                      title="Voice Reflection"
                      placeholder="Record voice note or transcribe speech..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 (Evening Only): Gentle Reflection */}
          {currentStep === 2 && checkinType === 'evening' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wider text-primary-dark">
                  Step 3 of {totalSteps}
                </span>
                <span className="text-sm text-stone-700 font-medium">Evening Reflection</span>
              </div>

              <div className="space-y-2">
                <h3 className="font-headline text-base font-semibold text-on-surface">
                  What weighed on your mind today, and what can you release this evening?
                </h3>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Take your time to write... Your thoughts are encrypted locally."
                  rows={4}
                  className="w-full p-4 rounded-2xl bg-surface border border-outline-variant focus:border-primary text-sm text-on-surface placeholder:text-stone-700 resize-none transition-all"
                  data-testid="evening-reflection-textarea"
                />
              </div>

              <div className="space-y-2">
                <VoiceNoteInput
                  value={freeText}
                  onChange={setFreeText}
                  title="Evening Voice Reflection"
                  placeholder="Record voice reflection or write thoughts here..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer & Navigation */}
        <div className="p-5 sm:p-6 border-t border-stone-300 bg-[#FAF7F0] flex flex-col sm:flex-row items-center justify-between gap-4" style={{ backgroundColor: '#FAF7F0' }}>
          <div className="flex items-center space-x-2 text-sm text-stone-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Encrypted • No streak pressure</span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-full border border-stone-800/50 bg-paper-card text-stone-700 hover:text-on-surface text-sm font-semibold transition-all shadow-xs"
              >
                Back
              </button>
            )}

            {currentStep < totalSteps - 1 ? (
              <button
                type="button"
                data-testid="continue-step-btn"
                onClick={handleNextStep}
                className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white text-base font-bold font-handwriting transition-all border-2 border-stone-800 shadow-notebook hover:shadow-xs inline-flex items-center space-x-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                data-testid="complete-checkin-btn"
                onClick={() => handleSubmitCheckin()}
                disabled={isSubmitting || submissionSuccess}
                className={`px-7 py-2.5 rounded-full text-base font-bold font-handwriting transition-all border-2 border-stone-800 shadow-notebook inline-flex items-center space-x-2 ${
                  submissionSuccess
                    ? 'bg-primary text-white cursor-default scale-105'
                    : isSubmitting
                    ? 'bg-paper text-stone-700 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark text-white hover:scale-102 active:scale-98'
                }`}
              >
                {submissionSuccess ? (
                  <motion.div
                    initial={{ scale: 0.8, rotate: -2 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="flex items-center space-x-2"
                  >
                    <Check className="w-5 h-5 text-white" />
                    <span>Moment Logged!</span>
                  </motion.div>
                ) : isSubmitting ? (
                  <>
                    <Lock className="w-4 h-4 animate-pulse" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Check-In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
