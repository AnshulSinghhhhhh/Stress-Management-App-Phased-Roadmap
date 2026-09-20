import React, { useState, useEffect } from 'react';
import { CalibratedIndicatorCard } from '../components/CalibratedIndicatorCard';
import { StressChart } from '../components/StressChart';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '../components/ui/Empty';
import { CheckinResponse, CalibratedIndicator, PacingStatus } from '../api/types';
import { apiClient } from '../api/client';
import {
  Plus,
  ShieldCheck,
  Clock,
  ArrowRight,
  Wind,
} from 'lucide-react';
import { PaperTape, DoodleStar, DoodleSparkle, DoodlePin } from '../components/DoodleIcons';

interface DashboardPageProps {
  onOpenCheckin: () => void;
  onTriggerRelief: (techniqueId?: string) => void;
  refreshTrigger?: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenCheckin,
  onTriggerRelief,
  refreshTrigger = 0,
}) => {
  const [recentCheckins, setRecentCheckins] = useState<CheckinResponse[]>([]);
  const [indicator, setIndicator] = useState<CalibratedIndicator | null>(null);
  const [pacingStatus, setPacingStatus] = useState<PacingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [checkins, ind, pacing] = await Promise.all([
        apiClient.getRecentCheckins(),
        apiClient.getCalibratedIndicator().catch(() => null),
        apiClient.getPacingStatus().catch(() => null),
      ]);
      setRecentCheckins(checkins);
      setIndicator(ind);
      setPacingStatus(pacing);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleAcceptToneForCheckin = async (checkinId: string, feelings: string[]) => {
    try {
      await apiClient.updateCheckinFeelings(checkinId, feelings);
      loadData();
    } catch (err) {
      console.error('Failed to accept tone for checkin:', err);
    }
  };

  // Today's check-ins filter
  const todayDateStr = new Date().toDateString();
  const todayCheckins = recentCheckins.filter(
    (c) => new Date(c.created_at).toDateString() === todayDateStr
  );

  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-8 py-4 animate-fade-in">
      {/* Hero Bar: Greeting, Calm Presence, and Exactly ONE Primary "+ Add Check-In" Button */}
      <section className="bg-paper border-2 border-stone-300 rounded-3xl p-6 sm:p-8 shadow-notebook relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <PaperTape className="absolute -top-2 left-8" angle={-2} />
        {/* Soft Ambient Backdrop Aura */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-secondary-container/20 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10 max-w-xl">
          <div className="flex items-center space-x-2">
            <h1 className="font-handwriting text-3xl sm:text-4xl font-bold text-ink tracking-tight">
              Good {greetingTime}. Check in at your pace.
            </h1>
          </div>
          <p className="text-sm text-stone-700 leading-relaxed font-sans">
            Welcome to your daily sanctuary notebook. Check in without streak anxiety, performance scores, or algorithmic urgency.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-stone-700 font-sans">
            <span className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-paper-yellow/70 border border-stone-300 text-stone-800 font-semibold text-xs">
              <DoodleStar className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {todayCheckins.length === 0
                  ? 'No check-ins logged yet today'
                  : `${todayCheckins.length} check-in${todayCheckins.length > 1 ? 's' : ''} logged today`}
              </span>
            </span>
            <span className="text-stone-300 hidden sm:inline">•</span>
            <span className="inline-flex items-center space-x-1.5 font-medium text-xs text-stone-600">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Private &amp; local compute</span>
            </span>
          </div>
        </div>

        {/* The Exactly ONE Primary + Add Check-In Control */}
        <div className="relative z-10 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={onOpenCheckin}
            data-testid="add-checkin-main-btn"
            className="px-6 py-3.5 rounded-full bg-primary hover:bg-primary-dark text-white font-bold text-sm transition-all shadow-notebook hover:shadow-notebook-lg active:translate-y-0.5 flex items-center justify-center space-x-2 border-2 border-stone-800"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="font-handwriting text-base">Record Check-In</span>
          </button>
        </div>
      </section>

      {/* Main Grid: Calibrated Stress Indicator + Companion Support */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Calibrated Indicator Card */}
        <div className="lg:col-span-2">
          <CalibratedIndicatorCard onTriggerAction={onTriggerRelief} />
        </div>

        {/* Right 1 Col: Quick Somatic Relief & Gentle Recommendations */}
        <div className="space-y-6">
          {/* Quick Relief Card */}
          <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 shadow-resting space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-primary-dark">
                <Wind className="w-5 h-5 text-primary" />
                <h2 className="font-headline text-base font-semibold text-on-surface">
                  Immediate Relief
                </h2>
              </div>
              <span className="text-sm text-stone-700 font-medium">2–3 min</span>
            </div>

            <p className="text-sm text-stone-700 leading-relaxed">
              If you feel tension or sensory overload, pause without opening questionnaires.
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => onTriggerRelief('square_breathing')}
                className="w-full p-3.5 rounded-xl bg-surface-container-low hover:bg-secondary-container/60 border border-outline-variant text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-semibold text-on-surface group-hover:text-primary-dark block">
                    4-4-4-4 Box Breathing
                  </span>
                  <span className="text-sm text-stone-700">
                    Simple breath pacing to settle tension
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-700 group-hover:text-primary transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => onTriggerRelief('grounding_54321')}
                className="w-full p-3.5 rounded-xl bg-surface-container-low hover:bg-secondary-container/60 border border-outline-variant text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-sm font-semibold text-on-surface group-hover:text-primary-dark block">
                    5-4-3-2-1 Sensory Reset
                  </span>
                  <span className="text-sm text-stone-700">
                    Engage physical senses to refocus awareness
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-700 group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>

          {/* Gentle Mindful Recommendations - Clutter-free without decorative icon spam */}
          <div className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 shadow-resting space-y-3">
            <h2 className="font-headline text-base font-semibold text-on-surface">
              Daily Reminders
            </h2>
            <ul className="space-y-2.5 text-sm text-stone-700">
              <li className="flex items-start space-x-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span>Unclench jaw, drop shoulders, and soften eye focus.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span>Drink water away from screen distractions.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span>Zero streak pressure. Missing check-ins is completely natural.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Today's Check-in Timeline */}
      <section className="bg-paper border-2 border-stone-300 rounded-3xl p-6 sm:p-7 shadow-notebook space-y-5 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-300 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <DoodleStar className="w-5 h-5 text-amber-500" />
              <h2 className="font-handwriting text-2xl font-bold text-ink">
                Today&apos;s Check-In Rhythm
              </h2>
            </div>
            <p className="text-sm text-stone-700 font-sans">
              Your logged moments today. Mindful pacing helps avoid anxious logging loops.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCheckin}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-paper-card hover:bg-paper-yellow/40 border border-stone-400 text-sm font-bold text-ink shadow-2xs hover:shadow-xs transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="font-handwriting text-base">Record Check-In</span>
          </button>
        </div>

        {/* Check-ins Timeline or Empty State */}
        {todayCheckins.length === 0 ? (
          <Empty className="my-4 bg-paper-card border border-stone-300 rounded-2xl p-8">
            <EmptyMedia variant="icon">
              <Clock className="w-6 h-6 text-primary" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No Check-Ins Logged Today</EmptyTitle>
              <EmptyDescription>
                Take a brief pause to note how you are feeling. There is no rigid schedule or penalty.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <button
                type="button"
                onClick={onOpenCheckin}
                className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-all shadow-notebook inline-flex items-center space-x-2 border border-stone-800"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Check-In</span>
              </button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-3">
            {todayCheckins.map((checkin, idx) => {
              const timeFormatted = new Date(checkin.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const stressVal = checkin.derived_stress_score ?? checkin.stress_score;
              const hasDetectedFeelings =
                checkin.detected_feelings &&
                checkin.detected_feelings.length > 0 &&
                !checkin.tags?.some((t) => checkin.detected_feelings?.includes(t));

              // Compute all trigger categories for multi-select support (v2.3 Part A1)
              const displayCategories =
                checkin.trigger_categories && checkin.trigger_categories.length > 0
                  ? checkin.trigger_categories
                  : checkin.trigger_category
                  ? [checkin.trigger_category]
                  : [];

              return (
                <div
                  key={checkin.id || idx}
                  className="p-4 rounded-2xl bg-paper-card border border-stone-300 flex flex-col gap-3 transition-all hover:bg-white shadow-2xs"
                  data-testid="timeline-checkin-item"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-full bg-paper-mint border border-stone-400 text-ink flex items-center justify-center shrink-0 font-handwriting text-base font-bold shadow-2xs">
                        {stressVal}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-ink capitalize font-sans">
                            {checkin.type} Check-In
                          </span>
                          <span className="text-xs text-stone-600 font-medium">
                            {timeFormatted}
                          </span>
                          {/* Multi-trigger badges */}
                          {displayCategories.map((cat) => (
                            <span
                              key={cat}
                              data-testid="timeline-trigger-badge"
                              className="px-2.5 py-0.5 rounded-md bg-paper-yellow border border-stone-400 text-xs font-bold text-stone-800 capitalize shadow-2xs"
                            >
                              {cat.replace('_', ' ')}
                            </span>
                          ))}
                          {checkin.tags && checkin.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {checkin.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-md bg-paper-mint/60 border border-stone-300 text-primary-dark text-xs font-semibold"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {checkin.free_text && (
                          <p className="text-sm text-stone-800 line-clamp-2 italic leading-relaxed font-sans bg-paper-yellow/20 px-2 py-1 rounded border-l-2 border-stone-400">
                            &ldquo;{checkin.free_text}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-auto shrink-0 font-sans">
                      <span className="text-sm font-semibold text-stone-700">
                        Mood {checkin.mood_score}/10
                      </span>
                      <span className="text-stone-400 text-sm font-bold">•</span>
                      <span className="text-sm font-bold text-primary-dark">
                        Stress {stressVal}/100
                      </span>
                    </div>
                  </div>

                  {/* Surface detected tone if pending confirmation (v2.2 Objective 2) */}
                  {hasDetectedFeelings && (
                    <div
                      className="p-3 rounded-xl bg-paper-yellow/40 border border-amber-300 flex flex-wrap items-center justify-between gap-2 text-sm"
                      data-testid="timeline-tone-suggestion"
                    >
                      <div className="flex items-center space-x-2 text-on-surface">
                        <span className="font-semibold text-primary-dark">Detected Tone:</span>
                        <span className="font-bold text-stone-900">
                          {checkin.detected_feelings?.join(', ')}
                        </span>
                        <span className="text-stone-700">— does this match?</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleAcceptToneForCheckin(checkin.id, checkin.detected_feelings || [])
                          }
                          className="px-3 py-1 rounded-full bg-primary hover:bg-primary-dark text-white font-medium text-xs transition-all shadow-2xs"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => loadData()}
                          className="px-3 py-1 rounded-full border border-stone-400 text-stone-700 hover:text-stone-900 text-xs font-medium bg-white"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Interactive Longitudinal Stress Trend Preview */}
      <section className="space-y-4">
        <StressChart onRefreshTrigger={refreshTrigger} />
      </section>
    </div>
  );
};
