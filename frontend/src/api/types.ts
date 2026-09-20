export type CheckinType = 'morning' | 'afternoon' | 'evening' | 'night' | 'manual' | 'custom' | string;

export type TriggerCategory =
  | 'work'
  | 'financial'
  | 'relationship'
  | 'health'
  | 'sleep'
  | 'social_loneliness'
  | 'identity';

export interface TriggerTagResponse {
  id: string;
  checkin_id: string;
  user_id: string;
  category: TriggerCategory;
  confidence: number;
  source: string;
  branch?: string | null;
  created_at: string;
}

export interface CheckinPayload {
  idempotency_key?: string;
  type: CheckinType;
  mood_score: number; // 1-10
  free_text?: string;
  tags?: string[];
  trigger_category?: TriggerCategory;
  trigger_categories?: TriggerCategory[];
  user_tz_offset_minutes?: number;
}

export interface CrisisResource {
  id: string;
  name: string;
  full_name: string;
  number: string;
  alt_number?: string | null;
  description: string;
  is_emergency: boolean;
  tap_to_call: string;
  provider: string;
}

export interface CrisisResponse {
  crisis_detected: boolean;
  detector_version?: string;
  copy?: {
    headline: string;
    message: string;
    subtext: string;
  };
  resources: CrisisResource[];
}

export interface CheckinResponse {
  id: string;
  user_id: string;
  idempotency_key?: string;
  type: CheckinType;
  mood_score: number;
  free_text?: string;
  tags?: string[];
  trigger_category?: TriggerCategory;
  trigger_categories?: TriggerCategory[];
  created_at: string;
  stress_score: number;
  daily_stress_score?: number;
  derived_stress_score?: number;
  confidence?: number;
  circadian_bucket?: string;
  crisis_detected?: boolean;
  crisis_payload?: CrisisResponse | null;
  probing_question?: string | null;
  detected_feelings?: string[];
  detected_feelings_confidence?: number;
  detected_feelings_source?: string;
}

export interface StressTrendPoint {
  date: string;
  score: number; // 0-100 normalized score
  confidence?: number;
  checkinCount: number;
  label?: string;
}

export interface LongitudinalTrendResponse {
  user_id: string;
  range: string;
  status: 'calibrating' | 'preliminary' | 'calibrated' | string;
  minimum_n_met: boolean;
  distinct_days: number;
  points: StressTrendPoint[];
}

export interface ContributingFactor {
  category: TriggerCategory;
  contribution_pct: number;
  weighted_frequency: number;
  mean_stress_present: number;
  mean_stress_absent: number;
  lift: number;
  evidence_checkin_ids?: string[];
  deterministic_reason: string;
}

export interface CalibratedIndicator {
  user_id: string;
  status: 'calibrating' | 'preliminary' | 'calibrated';
  current_score: number; // 0-100 scale
  confidence_score: number; // 0.0 - 1.0
  effective_sample_size: number;
  distinct_days: number;
  minimum_n_met: boolean;
  trend_direction?: 'rising' | 'stable' | 'easing' | null;
  trend_slope?: number | null;
  status_copy: string;
  contributing_factors: ContributingFactor[];
  recommended_action: {
    technique: string;
    title: string;
    reason: string;
  };
}

export interface PacingStatus {
  recent_checkin_exists: boolean;
  soft_branch_recommended: boolean;
  minutes_ago?: number;
  recent_mood_score?: number;
  recent_stress_score?: number;
  advisory_copy?: string | null;
}

export interface ConsentItem {
  consent_type: string;
  granted: boolean;
  version: string;
  granted_at?: string | null;
  revoked_at?: string | null;
}

export interface ConsentStatus {
  user_id: string;
  active_consents: Record<string, boolean>;
  history: ConsentItem[];
}


export interface BaselineQuestion {
  id: string;
  prompt: string;
  subtext: string;
  options: string[];
}

export interface BaselineProfile {
  completed: boolean;
  answers: Record<string, string>;
  created_at?: string;
}

export type ReliefTechniqueId = 'square_breathing' | 'grounding_54321' | 'somatic_pause';

export interface ReliefTechnique {
  id: ReliefTechniqueId;
  title: string;
  subtitle: string;
  durationMinutes: number;
  description: string;
  badge: string;
  stepsCount: number;
}

export interface ReliefSessionStart {
  id: string;
  technique: ReliefTechniqueId;
  started_at: string;
}

export interface ReliefSessionComplete {
  id: string;
  technique: ReliefTechniqueId;
  started_at: string;
  completed_at: string;
  self_reported_relief: number; // 1-5
}

export interface WearableStatus {
  appleHealth: boolean;
  fitbit: boolean;
  googleFit: boolean;
  lastSync?: string;
}

export interface BaselineSnapshot {
  id: string;
  user_id: string;
  scale_name: string;
  scale_version: string;
  score_raw?: number | null;
  score_normalized?: number | null;
  answers: Record<string, any>;
  notes?: string | null;
  created_at: string;
}

export interface CatalogQuestionItem {
  id: string;
  prompt: string;
  subtext?: string;
  construct?: string;
  response_type: 'likert_6' | 'single_choice' | 'free_text' | string;
  options?: string[];
  scoring_direction?: 'positive' | 'negative';
}

export interface QuestionnaireCatalog {
  baseline_anchor: {
    scale_name: string;
    scale_version: string;
    construct: string;
    recall_window: string;
    licensing: string;
    clinical_citation: string;
    items: CatalogQuestionItem[];
  };
  somatic_profile: {
    scale_name: string;
    items: CatalogQuestionItem[];
  };
  momentary_checkin: {
    scale_name: string;
    items: CatalogQuestionItem[];
    trigger_taxonomy: {
      category: TriggerCategory;
      label: string;
      description: string;
    }[];
  };
}
