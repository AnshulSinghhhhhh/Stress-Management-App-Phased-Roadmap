import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Check, Sparkles, Heart } from 'lucide-react';
import { ReliefTechniqueId } from '../api/types';
import { apiClient } from '../api/client';

interface ReliefTimerProps {
  techniqueId: ReliefTechniqueId;
  onClose: () => void;
  onSessionFinished?: () => void;
}

export const ReliefTimer: React.FC<ReliefTimerProps> = ({
  techniqueId,
  onClose,
  onSessionFinished,
}) => {
  const [isActive, setIsActive] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [selfRating, setSelfRating] = useState<number | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSaved, setRatingSaved] = useState(false);

  // Technique 1: 4-4-4-4 Box Breathing
  // Phases: Inhale (4s), Hold (4s), Exhale (4s), Hold (4s)
  const [boxPhaseIndex, setBoxPhaseIndex] = useState(0); // 0: Inhale, 1: Hold, 2: Exhale, 3: Hold
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(4);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  // Technique 2: 5-4-3-2-1 Sensory Grounding
  const groundingSteps = [
    { count: 5, label: 'Look around. Acknowledge 5 things you can see.', hint: 'A beam of light, texture on the table, leaves outside, a pen, shadow.' },
    { count: 4, label: 'Acknowledge 4 things you can physically feel.', hint: 'Feet on the floor, texture of your sleeve, back against the chair, cool air.' },
    { count: 3, label: 'Listen gently. Acknowledge 3 distinct sounds.', hint: 'Distant traffic, hum of a fan or refrigerator, your own quiet breath.' },
    { count: 2, label: 'Notice 2 things you can smell or remember smelling.', hint: 'Fresh air, coffee, rain on soil, clean cotton.' },
    { count: 1, label: 'Notice 1 comforting taste or sensation.', hint: 'Sip of water, resting tongue against palate, a deep unhurried sigh.' },
  ];
  const [groundingStepIndex, setGroundingStepIndex] = useState(0);

  // Technique 3: 3-Minute Somatic Pause
  const somaticSteps = [
    { title: 'Release the Jaw & Brow', duration: 60, guidance: 'Unclench your jaw. Let the tongue rest naturally. Release furrowing around your temples and eyelids.' },
    { title: 'Drop Shoulders & Hands', duration: 60, guidance: 'Gently lower your shoulders away from your ears. Open hands palms up. Feel the weight of your arms relax.' },
    { title: 'Belly Softening & Ease', duration: 60, guidance: 'Allow the abdominal wall to expand gently as you breathe in. No holding. Let gravity support your entire seat.' },
  ];
  const [somaticStepIndex, setSomaticStepIndex] = useState(0);
  const [somaticSecondsLeft, setSomaticSecondsLeft] = useState(60);

  // Start session API call on mount
  useEffect(() => {
    let mounted = true;
    apiClient.startReliefSession(techniqueId).then((session) => {
      if (mounted) setSessionId(session.id);
    });
    return () => {
      mounted = false;
    };
  }, [techniqueId]);

  // Box Breathing Timer Loop
  useEffect(() => {
    if (techniqueId !== 'square_breathing' || !isActive || isCompleted) return;

    const interval = setInterval(() => {
      setPhaseSecondsLeft((prev) => {
        if (prev <= 1) {
          setBoxPhaseIndex((currPhase) => {
            const next = (currPhase + 1) % 4;
            if (next === 0) {
              setCyclesCompleted((c) => {
                const updated = c + 1;
                if (updated >= 4) {
                  // Complete after 4 full cycles (~64s)
                  setIsCompleted(true);
                }
                return updated;
              });
            }
            return next;
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [techniqueId, isActive, isCompleted]);

  // Somatic Timer Loop
  useEffect(() => {
    if (techniqueId !== 'somatic_pause' || !isActive || isCompleted) return;

    const interval = setInterval(() => {
      setSomaticSecondsLeft((prev) => {
        if (prev <= 1) {
          if (somaticStepIndex < somaticSteps.length - 1) {
            setSomaticStepIndex((i) => i + 1);
            return 60;
          } else {
            setIsCompleted(true);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [techniqueId, isActive, isCompleted, somaticStepIndex]);

  const handleNextGroundingStep = () => {
    if (groundingStepIndex < groundingSteps.length - 1) {
      setGroundingStepIndex((i) => i + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleSaveRating = async (rating: number) => {
    setSelfRating(rating);
    setIsSubmittingRating(true);
    try {
      if (sessionId) {
        await apiClient.updateReliefSession(sessionId, rating);
      }
      setRatingSaved(true);
      setTimeout(() => {
        if (onSessionFinished) onSessionFinished();
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Failed to save rating:', err);
      setRatingSaved(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Box breathing helper labels
  const boxPhases = [
    { name: 'Inhale', desc: 'Drawing in slow, cool air', scale: 'scale-125' },
    { name: 'Hold', desc: 'Resting gently in stillness', scale: 'scale-125' },
    { name: 'Exhale', desc: 'Releasing all tension outwards', scale: 'scale-90' },
    { name: 'Hold', desc: 'Soft empty pause', scale: 'scale-90' },
  ];

  const currentBox = boxPhases[boxPhaseIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="relief-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl bg-surfaceLowest border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-modal relative flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guided relief"
          className="absolute top-5 right-5 p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!isCompleted ? (
          <>
            {/* Technique 1: Box Breathing */}
            {techniqueId === 'square_breathing' && (
              <div className="w-full flex flex-col items-center space-y-6">
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-widest text-primary font-semibold px-3 py-1 bg-secondary-container/50 rounded-full">
                    Cycle {cyclesCompleted + 1} of 4
                  </span>
                  <h2 id="relief-title" className="font-headline text-2xl font-medium text-on-surface pt-2">
                    4-4-4-4 Box Breathing
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    {currentBox.desc}
                  </p>
                </div>

                {/* Animated Breathing Orb */}
                <div className="relative w-64 h-64 flex items-center justify-center my-4">
                  {/* Outer aura */}
                  <div
                    className={`absolute inset-0 rounded-full bg-secondary-container/50 transition-all duration-[4000ms] ease-in-out ${
                      boxPhaseIndex === 0 || boxPhaseIndex === 1 ? 'scale-110 opacity-70' : 'scale-75 opacity-30'
                    }`}
                  />
                  {/* Middle ring */}
                  <div
                    className={`w-48 h-48 rounded-full border-2 border-primary/40 flex items-center justify-center transition-all duration-[4000ms] ease-in-out ${
                      boxPhaseIndex === 0 || boxPhaseIndex === 1 ? 'scale-105 bg-surfaceContainer/60' : 'scale-90 bg-surfaceLowest'
                    }`}
                  >
                    {/* Center Core */}
                    <div className="flex flex-col items-center justify-center space-y-1 z-10">
                      <span className="font-headline text-2xl font-semibold text-primary">
                        {currentBox.name}
                      </span>
                      <span className="font-mono text-3xl font-medium text-on-surface">
                        {phaseSecondsLeft}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Play / Pause & Reset controls */}
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container/80 transition-colors font-medium text-sm border border-outline-variant"
                  >
                    {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isActive ? 'Pause' : 'Resume'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCyclesCompleted(0);
                      setBoxPhaseIndex(0);
                      setPhaseSecondsLeft(4);
                    }}
                    className="p-2.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors border border-outline-variant"
                    aria-label="Restart exercise"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Technique 2: 5-4-3-2-1 Sensory Grounding */}
            {techniqueId === 'grounding_54321' && (
              <div className="w-full flex flex-col items-center space-y-6">
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-widest text-primary font-semibold px-3 py-1 bg-secondary-container/50 rounded-full">
                    Step {groundingStepIndex + 1} of 5
                  </span>
                  <h2 id="relief-title" className="font-headline text-2xl font-medium text-on-surface pt-2">
                    5-4-3-2-1 Sensory Grounding
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Anchor your mind into this exact physical room.
                  </p>
                </div>

                {/* Active Step Card */}
                <div className="w-full bg-surface-container-low border border-outline-variant rounded-2xl p-6 text-left space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-headline text-lg font-semibold">
                      {groundingSteps[groundingStepIndex].count}
                    </div>
                    <h3 className="font-headline text-lg font-medium text-on-surface">
                      {groundingSteps[groundingStepIndex].label}
                    </h3>
                  </div>
                  <p className="text-sm text-on-surface-variant pl-13 leading-relaxed">
                    <span className="font-medium text-primary">Ideas to notice: </span>
                    {groundingSteps[groundingStepIndex].hint}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleNextGroundingStep}
                  className="px-6 py-3 rounded-full bg-primary hover:bg-primary-dark text-white font-medium text-sm transition-all duration-200 shadow-sm active:scale-95"
                >
                  {groundingStepIndex < 4 ? 'I have noticed these • Next Step' : 'Complete Grounding'}
                </button>
              </div>
            )}

            {/* Technique 3: 3-Minute Somatic Pause */}
            {techniqueId === 'somatic_pause' && (
              <div className="w-full flex flex-col items-center space-y-6">
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-widest text-primary font-semibold px-3 py-1 bg-secondary-container/50 rounded-full">
                    Minute {somaticStepIndex + 1} of 3
                  </span>
                  <h2 id="relief-title" className="font-headline text-2xl font-medium text-on-surface pt-2">
                    3-Minute Somatic Pause
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Progressive gentle neuromuscular release
                  </p>
                </div>

                {/* Step Focus */}
                <div className="w-full bg-surface-container-low border border-outline-variant rounded-2xl p-6 text-center space-y-3">
                  <h3 className="font-headline text-xl font-medium text-primary">
                    {somaticSteps[somaticStepIndex].title}
                  </h3>
                  <p className="text-base text-on-surface-variant leading-relaxed max-w-md mx-auto">
                    {somaticSteps[somaticStepIndex].guidance}
                  </p>
                  <div className="pt-2 font-mono text-2xl font-medium text-on-surface">
                    {somaticSecondsLeft}s remaining
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className="px-5 py-2.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container/80 transition-colors font-medium text-sm border border-outline-variant inline-flex items-center space-x-2"
                  >
                    {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isActive ? 'Pause' : 'Resume'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (somaticStepIndex < 2) {
                        setSomaticStepIndex((i) => i + 1);
                        setSomaticSecondsLeft(60);
                      } else {
                        setIsCompleted(true);
                      }
                    }}
                    className="px-5 py-2.5 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors font-medium text-sm"
                  >
                    Next Area
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Completion & Pre/Post Self-Reported Relief Rating */
          <div className="w-full flex flex-col items-center space-y-6 py-2">
            <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center text-primary shadow-sm">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="font-headline text-2xl font-medium text-on-surface">
                Pause complete
              </h2>
              <p className="text-sm text-on-surface-variant max-w-md">
                Take a gentle breath. How does your body feel now compared to before this exercise?
              </p>
            </div>

            {/* 1-5 Relief Rating Pills */}
            <div className="w-full space-y-3">
              <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Self-Reported Relief (1 to 5)
              </label>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {[
                  { rating: 1, text: 'Slight ease' },
                  { rating: 2, text: 'A bit lighter' },
                  { rating: 3, text: 'Noticeably calmer' },
                  { rating: 4, text: 'Centered' },
                  { rating: 5, text: 'Deep relief' },
                ].map(({ rating, text }) => {
                  const isSelected = selfRating === rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      disabled={isSubmittingRating || ratingSaved}
                      onClick={() => handleSaveRating(rating)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-md scale-105'
                          : 'bg-surfaceLowest border-outline-variant hover:border-primary hover:bg-surfaceContainer text-on-surface'
                      }`}
                    >
                      <span className="font-headline text-lg font-semibold">{rating}</span>
                      <span className="text-[11px] font-normal leading-tight text-center mt-1">
                        {text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {ratingSaved && (
              <div className="flex items-center space-x-2 text-primary font-medium text-sm bg-secondary-container/60 px-4 py-2 rounded-full animate-fade-in">
                <Check className="w-4 h-4" />
                <span>Thank you. Your relief session has been gently recorded.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
