export type CheckinType = 'morning' | 'evening' | 'manual';

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
  type: CheckinType;
  mood_score: number; // 1-10
  free_text?: string;
  tags?: string[];
  trigger_category?: TriggerCategory;
  trigger_categories?: TriggerCategory[];
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
  type: CheckinType;
  mood_score: number;
  free_text?: string;
  tags?: string[];
  created_at: string;
  stress_score: number;
  crisis_detected?: boolean;
  crisis_payload?: CrisisResponse | null;
  probing_question?: string | null;
}

export interface StressTrendPoint {
  date: string;
  score: number; // 1-10
  checkinCount: number;
  label?: string;
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
