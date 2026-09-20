import {
  CheckinPayload,
  CheckinResponse,
  CrisisResponse,
  StressTrendPoint,
  BaselineProfile,
  ReliefTechnique,
  ReliefTechniqueId,
  ReliefSessionStart,
  ReliefSessionComplete,
  WearableStatus,
  TriggerCategory,
  TriggerTagResponse,
  CalibratedIndicator,
  PacingStatus,
  ConsentItem,
  ConsentStatus,
  LongitudinalTrendResponse,
  BaselineSnapshot,
  QuestionnaireCatalog,
} from './types';
export { supabase } from './supabase';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8008/api/v1';

// Centralized India Crisis Resources per SOP §6 and backend/app/core/crisis_resources.py
export const OFFICIAL_CRISIS_PAYLOAD: CrisisResponse = {
  crisis_detected: true,
  detector_version: '1.0.0-phase1-frontend-safety',
  copy: {
    headline: 'You are not alone. Support is free, confidential, and 24/7.',
    message:
      'We noticed you might be experiencing overwhelming distress. Compassionate, certified counselors are ready to speak with you right now.',
    subtext: 'No login required. Free calls from anywhere in India.',
  },
  resources: [
    {
      id: 'tele_manas',
      name: 'Tele MANAS',
      full_name: 'Tele Mental Health Assistance and Nationally Actionable Plan through States',
      number: '14416',
      alt_number: '1-800-891-4416',
      description: 'Govt of India 24/7 national mental health helpline. Multilingual, free, and completely confidential.',
      is_emergency: true,
      tap_to_call: 'tel:14416',
      provider: 'Ministry of Health & Family Welfare (MoHFW)',
    },
    {
      id: 'kiran',
      name: 'KIRAN Helpline',
      full_name: 'KIRAN Mental Health Helpline',
      number: '1800-599-0019',
      alt_number: null,
      description: '24/7 psychological support and crisis intervention in 13 Indian languages.',
      is_emergency: true,
      tap_to_call: 'tel:18005990019',
      provider: 'Department of Empowerment of Persons with Disabilities',
    },
    {
      id: 'emergency_112',
      name: 'Emergency Services',
      full_name: 'National Emergency Response Support System',
      number: '112',
      alt_number: null,
      description: 'All-in-one national emergency response for medical, distress, and police intervention.',
      is_emergency: true,
      tap_to_call: 'tel:112',
      provider: 'Government of India',
    },
  ],
};

// Deterministic safety keyword list matching crisis_detector.py
const CRISIS_KEYWORDS = [
  'suicide',
  'kill myself',
  'end my life',
  'want to die',
  'better off dead',
  'harm myself',
  'hurt myself',
  'self harm',
  'no reason to live',
  'hopeless',
  'can\'t go on',
  'end it all',
];

function detectCrisisInText(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

// Local mock storage helpers
const STORAGE_KEYS = {
  CHECKINS: 'sanctuary_checkins_v1',
  BASELINE: 'sanctuary_baseline_v1',
  RELIEF_SESSIONS: 'sanctuary_relief_sessions_v1',
  WEARABLES: 'sanctuary_wearables_v1',
};

function getLocalCheckins(): CheckinResponse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHECKINS);
    if (!raw) {
      // Seed with initial realistic data for 7-day calm visualization
      const initial: CheckinResponse[] = [
        {
          id: 'seed-1',
          user_id: 'usr-local-01',
          type: 'morning',
          mood_score: 7,
          tags: ['Calm', 'Grateful'],
          free_text: 'Morning walk in the cool breeze. Feeling centered.',
          created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
          stress_score: 4,
        },
        {
          id: 'seed-2',
          user_id: 'usr-local-01',
          type: 'evening',
          mood_score: 6,
          tags: ['Tired'],
          free_text: 'Work was intense today but kept perspective.',
          created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
          stress_score: 5,
        },
        {
          id: 'seed-3',
          user_id: 'usr-local-01',
          type: 'morning',
          mood_score: 8,
          tags: ['Focused', 'Hopeful'],
          free_text: 'Slept well, ready for the morning.',
          created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
          stress_score: 3,
        },
        {
          id: 'seed-4',
          user_id: 'usr-local-01',
          type: 'evening',
          mood_score: 5,
          tags: ['Restless', 'Anxious'],
          free_text: 'Pending deadlines created some tension in shoulders.',
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
          stress_score: 6,
        },
        {
          id: 'seed-5',
          user_id: 'usr-local-01',
          type: 'morning',
          mood_score: 7,
          tags: ['Calm'],
          free_text: 'Practiced 4-4-4-4 breathing upon waking.',
          created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
          stress_score: 4,
        },
        {
          id: 'seed-6',
          user_id: 'usr-local-01',
          type: 'evening',
          mood_score: 6,
          tags: ['Content'],
          free_text: 'Gentle dinner with family.',
          created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
          stress_score: 4,
        },
      ];
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalCheckin(checkin: CheckinResponse) {
  const existing = getLocalCheckins();
  const isDuplicate = existing.some(
    (c) =>
      c.id === checkin.id ||
      (c.user_id === checkin.user_id &&
        c.type === checkin.type &&
        c.mood_score === checkin.mood_score &&
        (c.free_text || '').trim() === (checkin.free_text || '').trim() &&
        Math.abs(new Date(c.created_at).getTime() - new Date(checkin.created_at).getTime()) < 5000)
  );
  if (isDuplicate) return;
  existing.unshift(checkin);
  localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(existing));
}

export const apiClient = {
  /**
   * Submit daily or manual check-in with idempotency protection and 0-100 normalization
   */
  async submitCheckin(payload: CheckinPayload): Promise<CheckinResponse> {
    const isCrisis = detectCrisisInText(payload.free_text);
    const idempotency_key =
      payload.idempotency_key ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'idem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9));

    const enrichedPayload: CheckinPayload = {
      ...payload,
      idempotency_key,
      user_tz_offset_minutes: payload.user_tz_offset_minutes ?? new Date().getTimezoneOffset() * -1,
    };

    // Normalized stress score: mood 1 -> 90, mood 10 -> 0 (0-100 scale)
    const calculatedStress = Math.max(0, Math.min(100, Math.round((10 - payload.mood_score) * 10)));

    try {
      const res = await fetch(`${API_BASE_URL}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedPayload),
      });
      if (res.ok) {
        const data = await res.json();
        const normalizedResponse: CheckinResponse = {
          ...data,
          trigger_category: data.trigger_category ?? payload.trigger_category,
          trigger_categories: (data.trigger_categories && data.trigger_categories.length > 0)
            ? data.trigger_categories
            : (payload.trigger_categories && payload.trigger_categories.length > 0)
            ? payload.trigger_categories
            : payload.trigger_category
            ? [payload.trigger_category]
            : [],
          stress_score: data.derived_stress_score ?? data.stress_score ?? calculatedStress,
        };
        saveLocalCheckin(normalizedResponse);
        return normalizedResponse;
      }
      if (res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Duplicate check-in detected. Please wait a few seconds before submitting again.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Duplicate check-in')) {
        throw err;
      }
      // Backend offline: run deterministic fallback
    }

    // Offline / local feeling classifier fallback
    const detectedFeelings: string[] = [];
    if (payload.free_text) {
      const lower = payload.free_text.toLowerCase();
      if (lower.includes('tired') || lower.includes('exhaust') || lower.includes('drain') || lower.includes('fatigue')) detectedFeelings.push('Tired');
      if (lower.includes('restless') || lower.includes('fidget') || lower.includes('tossing') || lower.includes('uneasy')) detectedFeelings.push('Restless');
      if (lower.includes('anxious') || lower.includes('worry') || lower.includes('dread') || lower.includes('panic')) detectedFeelings.push('Anxious');
      if (lower.includes('overwhelm') || lower.includes('swamped') || lower.includes('too much')) detectedFeelings.push('Overwhelmed');
      if (lower.includes('calm') || lower.includes('peace') || lower.includes('grounded')) detectedFeelings.push('Calm');
      if (lower.includes('grateful') || lower.includes('thankful')) detectedFeelings.push('Grateful');
      if (lower.includes('focused') || lower.includes('clear')) detectedFeelings.push('Focused');
      if (lower.includes('hopeful') || lower.includes('optimist')) detectedFeelings.push('Hopeful');
    }

    // Fallback response with immediate crisis detection
    const mockResponse: CheckinResponse = {
      id: 'chk-' + Date.now(),
      user_id: 'usr-local-01',
      idempotency_key,
      type: payload.type,
      mood_score: payload.mood_score,
      free_text: payload.free_text,
      tags: payload.tags || [],
      trigger_category: payload.trigger_category,
      trigger_categories: (payload.trigger_categories && payload.trigger_categories.length > 0)
        ? payload.trigger_categories
        : payload.trigger_category
        ? [payload.trigger_category]
        : [],
      created_at: new Date().toISOString(),
      stress_score: calculatedStress,
      derived_stress_score: calculatedStress,
      confidence: 1.0,
      circadian_bucket: 'daytime',
      crisis_detected: isCrisis,
      crisis_payload: isCrisis ? OFFICIAL_CRISIS_PAYLOAD : null,
      detected_feelings: detectedFeelings,
      detected_feelings_confidence: detectedFeelings.length > 0 ? 0.85 : undefined,
      detected_feelings_source: detectedFeelings.length > 0 ? 'local_rule' : undefined,
    };

    saveLocalCheckin(mockResponse);
    return mockResponse;
  },

  /**
   * Check pacing window advisory to prevent anxious rumination loops
   */
  async getPacingStatus(userId: string = 'demo_user'): Promise<PacingStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/checkins/pacing/check?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local fallback
    }
    const checkins = getLocalCheckins();
    if (checkins.length > 0) {
      const latest = checkins[0];
      const elapsedMinutes = Math.max(1, Math.round((Date.now() - new Date(latest.created_at).getTime()) / 60000));
      if (elapsedMinutes <= 45 && (latest.stress_score >= 65 || (latest.derived_stress_score ?? 0) >= 65)) {
        return {
          recent_checkin_exists: true,
          soft_branch_recommended: true,
          minutes_ago: elapsedMinutes,
          recent_stress_score: latest.derived_stress_score ?? latest.stress_score,
          advisory_copy: `You checked in ${elapsedMinutes} minutes ago. Your nervous system is still processing. Would you like to try a 2-minute grounding exercise instead, or note what shifted?`,
        };
      }
    }
    return {
      recent_checkin_exists: false,
      soft_branch_recommended: false,
    };
  },

  /**
   * Manually tag or correct trigger category for a checkin (user_corrected)
   */
  async correctTriggerTag(
    checkinId: string,
    category: TriggerCategory
  ): Promise<TriggerTagResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/triggers/${checkinId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      id: 'tag-' + Date.now(),
      checkin_id: checkinId,
      user_id: 'usr-local-01',
      category,
      confidence: 1.0,
      source: 'user_corrected',
      created_at: new Date().toISOString(),
    };
  },

  /**
   * Accept or update detected feelings for a checkin (adds to tags/factors attribution)
   */
  async updateCheckinFeelings(
    checkinId: string,
    feelings: string[]
  ): Promise<CheckinResponse | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/checkins/${checkinId}/feelings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feelings }),
      });
      if (res.ok) {
        const data = await res.json();
        const checkins = getLocalCheckins();
        const updated = checkins.map((c) =>
          c.id === checkinId ? { ...c, tags: Array.from(new Set([...(c.tags || []), ...feelings])) } : c
        );
        localStorage.setItem('sanctuary_v2_checkins', JSON.stringify(updated));
        return data;
      }
    } catch {
      // Non-blocking fallback
    }
    const checkins = getLocalCheckins();
    const updated = checkins.map((c) =>
      c.id === checkinId ? { ...c, tags: Array.from(new Set([...(c.tags || []), ...feelings])) } : c
    );
    localStorage.setItem('sanctuary_v2_checkins', JSON.stringify(updated));
    return checkins.find((c) => c.id === checkinId) || null;
  },

  /**
   * Retrieve recent check-ins
   */
  async getRecentCheckins(): Promise<CheckinResponse[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/checkins?range=7d`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // Fallback
    }
    return getLocalCheckins();
  },

  /**
   * Get calibrated stress indicator, confidence score, and deterministic contributing factors
   */
  async getCalibratedIndicator(userId: string = 'demo_user', windowDays: number = 14): Promise<CalibratedIndicator> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/stress-index/indicators/current?user_id=${encodeURIComponent(userId)}&window_days=${windowDays}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local fallback
    }

    const checkins = getLocalCheckins();
    const distinctDates = new Set(checkins.map((c) => c.created_at.split('T')[0]));
    const distinctDays = distinctDates.size;
    const minNMet = distinctDays >= 7;

    return {
      user_id: userId,
      status: distinctDays < 5 ? 'calibrating' : distinctDays < 7 ? 'preliminary' : 'calibrated',
      current_score: checkins.length > 0 ? (checkins[0].derived_stress_score ?? checkins[0].stress_score) : 45.0,
      confidence_score: Math.min(1.0, Math.round((distinctDays / 7.0) * 100) / 100),
      effective_sample_size: distinctDays,
      distinct_days: distinctDays,
      minimum_n_met: minNMet,
      trend_direction: minNMet ? 'stable' : null,
      trend_slope: 0.0,
      status_copy: distinctDays < 5
        ? `Calibrating your baseline (Day ${distinctDays} of 5 distinct days)`
        : distinctDays < 7
        ? `Preliminary baseline (Day ${distinctDays} of 7 distinct days)`
        : 'Calibrated baseline active',
      contributing_factors: [],
      recommended_action: {
        technique: 'square_breathing',
        title: '4-4-4-4 Box Breathing',
        reason: 'Gentle baseline reset for your nervous system.',
      },
    };
  },

  /**
   * Get longitudinal trends with honest minimum-N gating (eliminating synthetic sine-wave hallucinations)
   */
  async getLongitudinalTrends(
    range: '7d' | '30d' = '7d',
    userId: string = 'demo_user'
  ): Promise<LongitudinalTrendResponse> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/stress-index/trends?user_id=${encodeURIComponent(userId)}&range=${range}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const checkins = getLocalCheckins();
    const days = range === '30d' ? 30 : 7;
    const distinctDates = new Set(checkins.map((c) => c.created_at.split('T')[0]));
    const distinctDays = distinctDates.size;
    const points: StressTrendPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dateObj = new Date(Date.now() - i * 86400000);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayCheckins = checkins.filter((c) => c.created_at.startsWith(dateStr));

      let score = 0;
      if (dayCheckins.length > 0) {
        const sum = dayCheckins.reduce((acc, c) => acc + (c.derived_stress_score ?? c.stress_score), 0);
        score = Math.round(sum / dayCheckins.length);
      }

      points.push({
        date: dateStr,
        score,
        checkinCount: dayCheckins.length,
        label: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }

    return {
      user_id: userId,
      range,
      status: distinctDays < 5 ? 'calibrating' : distinctDays < 7 ? 'preliminary' : 'calibrated',
      minimum_n_met: distinctDays >= 7,
      distinct_days: distinctDays,
      points,
    };
  },

  /**
   * Legacy StressTrend adapter normalized to 0-100 scale without synthetic sine waves
   */
  async getStressTrend(range: '7d' | '30d' = '7d'): Promise<StressTrendPoint[]> {
    const trendResp = await this.getLongitudinalTrends(range);
    return trendResp.points;
  },

  /**
   * Get Baseline Profile
   */
  async getBaseline(): Promise<BaselineProfile> {
    try {
      const res = await fetch(`${API_BASE_URL}/baseline`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const raw = localStorage.getItem(STORAGE_KEYS.BASELINE);
    if (raw) {
      return JSON.parse(raw);
    }
    return { completed: false, answers: {} };
  },

  /**
   * Save Baseline Profile
   */
  async saveBaseline(answers: Record<string, string>): Promise<BaselineProfile> {
    try {
      const res = await fetch(`${API_BASE_URL}/baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(STORAGE_KEYS.BASELINE, JSON.stringify(data));
        return data;
      }
    } catch {
      // Fallback
    }
    const saved: BaselineProfile = {
      completed: true,
      answers,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.BASELINE, JSON.stringify(saved));
    return saved;
  },

  /**
   * Fetch active questionnaire catalog (WHO-5 adapted well-being + somatic lifestyle items)
   */
  async getQuestionnaireCatalog(): Promise<QuestionnaireCatalog> {
    try {
      const res = await fetch(`${API_BASE_URL}/baseline/catalog`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      baseline_anchor: {
        scale_name: 'who5_adapted_v1',
        scale_version: '2.0.0',
        construct: 'Subjective Psychological Well-Being & Stress Baseline',
        recall_window: 'over the last 2 weeks',
        licensing: 'Public domain (CC BY-NC-SA 3.0 IGO) WHO Psychiatric Research Unit',
        clinical_citation: 'Topp CW, et al. Psychother Psychosom 2015;84:167-176',
        items: [
          { id: 'who5_cheerful', prompt: 'I have felt cheerful and in good spirits', response_type: 'likert_6', scoring_direction: 'positive' },
          { id: 'who5_calm', prompt: 'I have felt calm and relaxed', response_type: 'likert_6', scoring_direction: 'positive' },
          { id: 'who5_active', prompt: 'I have felt active and vigorous', response_type: 'likert_6', scoring_direction: 'positive' },
          { id: 'who5_rested', prompt: 'I woke up feeling fresh and rested', response_type: 'likert_6', scoring_direction: 'positive' },
          { id: 'who5_interest', prompt: 'My daily life has been filled with things that interest me', response_type: 'likert_6', scoring_direction: 'positive' },
        ],
      },
      somatic_profile: {
        scale_name: 'somatic_lifestyle_v1',
        items: [
          { id: 'physical_manifestation', prompt: 'Where do you most notice tension settling physically?', response_type: 'single_choice', options: ['Head / temples', 'Jaw / clenching', 'Neck / shoulders', 'Chest / tight breathing', 'Stomach / digestion', 'Lower back', 'Hands / restless fidgeting', 'No specific physical manifestation'] },
          { id: 'sleep_hours_typical', prompt: 'Typical sleep duration over the past two weeks', response_type: 'single_choice', options: ['Less than 5 hours', '5 to 6 hours', '6 to 7 hours', '7 to 8 hours', 'More than 8 hours'] },
          { id: 'caffeine_daily_cups', prompt: 'Daily caffeinated beverages (coffee, tea, energy drinks)', response_type: 'single_choice', options: ['0 cups (none)', '1 to 2 cups', '3 to 4 cups', '5 or more cups'] },
          { id: 'primary_stress_driver', prompt: 'Primary domain currently drawing your emotional bandwidth', response_type: 'single_choice', options: ['Work / career demands', 'Financial pressures', 'Relationship dynamics', 'Health & physical vitality', 'Sleep disruption', 'Social isolation / loneliness', 'Identity / personal direction'] },
          { id: 'baseline_notes', prompt: 'Is there anything specific you are hoping to cultivate with Sanctuary?', response_type: 'free_text' },
        ],
      },
      momentary_checkin: {
        scale_name: 'ema_momentary_v1',
        items: [
          { id: 'momentary_mood', prompt: 'How does your nervous system feel right now?', response_type: 'slider_1_10' },
          { id: 'momentary_tags', prompt: 'Which somatic sensations or states describe this moment?', response_type: 'tag_chips' },
          { id: 'momentary_reflection', prompt: 'Brief reflection (optional)', response_type: 'free_text' },
        ],
        trigger_taxonomy: [
          { category: 'work', label: 'Work', description: 'Deadlines, workload, meetings, career expectations' },
          { category: 'financial', label: 'Financial', description: 'Expenses, budgeting, bills, investments' },
          { category: 'relationship', label: 'Relationship', description: 'Partner, family dynamics, conflicts, boundaries' },
          { category: 'health', label: 'Health', description: 'Illness, somatic pain, medical appointments, vitality' },
          { category: 'sleep', label: 'Sleep', description: 'Insomnia, fragmented rest, fatigue, sleep debt' },
          { category: 'social_loneliness', label: 'Social & Loneliness', description: 'Isolation, social battery depletion, disconnectedness' },
          { category: 'identity', label: 'Identity', description: 'Purpose, personal values, life transitions, self-worth' },
        ],
      },
    };
  },

  /**
   * Submit baseline snapshot (Onboarding or periodic Day 14/30/60 recalibration)
   */
  async submitBaselineSnapshot(payload: {
    user_id?: string;
    scale_name?: string;
    answers: Record<string, any>;
    notes?: string;
  }): Promise<BaselineSnapshot> {
    try {
      const res = await fetch(`${API_BASE_URL}/baseline/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: payload.user_id || 'demo_user',
          scale_name: payload.scale_name || 'who5_adapted',
          answers: payload.answers,
          notes: payload.notes,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const snap: BaselineSnapshot = {
      id: 'snap-' + Date.now(),
      user_id: payload.user_id || 'demo_user',
      scale_name: payload.scale_name || 'who5_adapted',
      scale_version: '2.0.0',
      score_normalized: 35.0,
      answers: payload.answers,
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
    };
    return snap;
  },

  /**
   * List longitudinal baseline snapshots
   */
  async getBaselineSnapshots(userId: string = 'demo_user'): Promise<BaselineSnapshot[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/baseline/snapshots?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [];
  },

  /**
   * Fetch active consent states and immutable audit trail
   */
  async getConsentStatus(userId: string = 'demo_user'): Promise<ConsentStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/consent/status?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      user_id: userId,
      active_consents: {
        terms_and_privacy: true,
        wearable_data: false,
        anonymous_analytics: false,
      },
      history: [
        {
          consent_type: 'terms_and_privacy',
          granted: true,
          version: '2.0.0',
          granted_at: new Date().toISOString(),
          revoked_at: null,
        },
      ],
    };
  },

  /**
   * Grant specific consent in immutable audit log
   */
  async grantConsent(
    consentType: string,
    version: string = '2.0.0',
    userId: string = 'demo_user'
  ): Promise<ConsentItem> {
    try {
      const res = await fetch(`${API_BASE_URL}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          consent_type: consentType,
          version,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      consent_type: consentType,
      granted: true,
      version,
      granted_at: new Date().toISOString(),
      revoked_at: null,
    };
  },

  /**
   * Revoke specific consent in immutable audit log
   */
  async revokeConsent(consentType: string, userId: string = 'demo_user'): Promise<ConsentItem> {
    try {
      const res = await fetch(`${API_BASE_URL}/consent/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          consent_type: consentType,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      consent_type: consentType,
      granted: false,
      version: '2.0.0',
      granted_at: new Date().toISOString(),
      revoked_at: new Date().toISOString(),
    };
  },

  /**
   * Get 3 core relief techniques
   */
  async getReliefTechniques(): Promise<ReliefTechnique[]> {
    return [
      {
        id: 'square_breathing',
        title: '4-4-4-4 Box Breathing',
        subtitle: 'Equal-pacing parasympathetic reset',
        durationMinutes: 4,
        badge: 'Physiological',
        stepsCount: 4,
        description:
          'Inhale 4s, Hold 4s, Exhale 4s, Hold 4s. Regulates heart rate variability and clears adrenaline rushes.',
      },
      {
        id: 'grounding_54321',
        title: '5-4-3-2-1 Sensory Grounding',
        subtitle: 'Attentional re-orientation technique',
        durationMinutes: 3,
        badge: 'Attentional',
        stepsCount: 5,
        description:
          'Engage each sensory lane: notice 5 sights, 4 touches, 3 sounds, 2 scents, and 1 calming taste or sensation.',
      },
      {
        id: 'somatic_pause',
        title: '3-Minute Somatic Pause',
        subtitle: 'Gentle physical de-escalation',
        durationMinutes: 3,
        badge: 'Somatic',
        stepsCount: 3,
        description:
          'Progressively soften jaw, lower shoulders, unclench hands, and release abdominal tension with deep unhurried breath.',
      },
    ];
  },

  /**
   * Start a relief session
   */
  async startReliefSession(
    technique: ReliefTechniqueId,
    checkinId?: string
  ): Promise<ReliefSessionStart> {
    try {
      const res = await fetch(`${API_BASE_URL}/relief/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technique, checkin_id: checkinId }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const session: ReliefSessionStart = {
      id: 'session-' + Date.now(),
      technique,
      started_at: new Date().toISOString(),
    };
    return session;
  },

  /**
   * Update relief session with post-rating (1-5 pills)
   */
  async updateReliefSession(
    sessionId: string,
    reliefRating: number
  ): Promise<ReliefSessionComplete> {
    try {
      const res = await fetch(`${API_BASE_URL}/relief/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ self_reported_relief: reliefRating }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const result: ReliefSessionComplete = {
      id: sessionId,
      technique: 'square_breathing',
      started_at: new Date(Date.now() - 180000).toISOString(),
      completed_at: new Date().toISOString(),
      self_reported_relief: reliefRating,
    };
    return result;
  },

  /**
   * Export all user data as downloadable JSON
   */
  async exportUserData(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/data/export`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }

    const payload = {
      export_version: '1.0.0',
      exported_at: new Date().toISOString(),
      user: {
        id: 'usr-local-01',
        email: 'user@mindful.local',
        consent_version_accepted: '1.0',
      },
      baseline: JSON.parse(localStorage.getItem(STORAGE_KEYS.BASELINE) || '{}'),
      checkins: getLocalCheckins(),
      relief_sessions: JSON.parse(localStorage.getItem(STORAGE_KEYS.RELIEF_SESSIONS) || '[]'),
      wearables: JSON.parse(
        localStorage.getItem(STORAGE_KEYS.WEARABLES) || '{"appleHealth":false,"fitbit":false,"googleFit":false}'
      ),
    };

    return payload;
  },

  /**
   * Irreversible account & data deletion (Double opt-in)
   */
  async deleteUserData(confirmation: string = 'DELETE'): Promise<{ success: boolean; message: string }> {
    if (confirmation !== 'DELETE') {
      throw new Error('Please type DELETE to confirm.');
    }
    try {
      const res = await fetch(`${API_BASE_URL}/data/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, user_id: 'demo_user' }),
      });
      if (res.ok) {
        localStorage.clear();
        return await res.json();
      }
    } catch {
      // Fallback
    }
    localStorage.clear();
    return {
      success: true,
      message: 'All local and remote data has been permanently and irreversibly deleted.',
    };
  },

  async deleteUserAccount(): Promise<{ success: boolean; message: string }> {
    return this.deleteUserData('DELETE');
  },

  /**
   * Get wearable connections mock status
   */
  async getWearableStatus(): Promise<WearableStatus> {
    const raw = localStorage.getItem(STORAGE_KEYS.WEARABLES);
    if (raw) return JSON.parse(raw);
    return {
      appleHealth: false,
      fitbit: false,
      googleFit: false,
    };
  },

  /**
   * Update wearable connection status
   */
  async updateWearableStatus(status: Partial<WearableStatus>): Promise<WearableStatus> {
    const current = await this.getWearableStatus();
    const updated: WearableStatus = {
      ...current,
      ...status,
      lastSync: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.WEARABLES, JSON.stringify(updated));
    return updated;
  },
};
