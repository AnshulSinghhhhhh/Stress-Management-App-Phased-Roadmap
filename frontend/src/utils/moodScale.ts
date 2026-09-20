/**
 * LightGAP / Sanctuary — Definitive Scale Polarity & Single Source of Truth
 *
 * DEFINITIVE CONVENTION (matches backend stress formula (10 - mood) * 10):
 *   1 = Highest Tension / Most Stressed
 *   10 = Most Calm / Most Centered
 */

export type ScaleTone = 'high_tension' | 'elevated_tension' | 'steady' | 'calm' | 'deep_calm';

export interface ScaleDescriptor {
  value: number; // 1 to 10
  category: string;
  description: string;
  stressLevel: number; // 0-100 derived stress
  tone: ScaleTone;
  accentColor: string; // High-contrast ink color
  bgPillColor: string;
}

export const SCALE_CONVENTION = {
  MIN_VALUE: 1,
  MAX_VALUE: 10,
  MIN_LABEL: 'Highest Tension',
  MID_LABEL: 'Steady',
  MAX_LABEL: 'Most Calm',
  INLINE_CAPTION: '1 = Highest Tension, 10 = Most Calm',
} as const;

/**
 * Single source of truth for mood rating descriptor lookup.
 * Guaranteed monotonic: higher rating -> lower stress & calmer state.
 */
export function getMoodScaleDescriptor(value: number): ScaleDescriptor {
  const clamped = Math.max(1, Math.min(10, Math.round(value)));
  const stressLevel = (10 - clamped) * 10;

  if (clamped <= 2) {
    return {
      value: clamped,
      category: 'Highest Tension / Depleted',
      description: 'Noticeable strain or sensory overload. Permission to pause completely.',
      stressLevel,
      tone: 'high_tension',
      accentColor: '#855146', // terracotta dark (>= 6.1:1 AA)
      bgPillColor: 'rgba(238, 187, 175, 0.45)',
    };
  }
  if (clamped <= 4) {
    return {
      value: clamped,
      category: 'Elevated Tension',
      description: 'Clenched jaw, tight shoulders, or racing thoughts. A brief pause can help.',
      stressLevel,
      tone: 'elevated_tension',
      accentColor: '#A36B5E', // terracotta
      bgPillColor: 'rgba(238, 187, 175, 0.35)',
    };
  }
  if (clamped <= 6) {
    return {
      value: clamped,
      category: 'Balanced / Steady',
      description: 'Operational daily baseline. Focused and present at a steady pace.',
      stressLevel,
      tone: 'steady',
      accentColor: '#435C4B', // sage dark (>= 7.0:1 AAA)
      bgPillColor: 'rgba(218, 230, 220, 0.55)',
    };
  }
  if (clamped <= 8) {
    return {
      value: clamped,
      category: 'Calm & Grounded',
      description: 'Settled nervous system, steady breathing, and peaceful clarity.',
      stressLevel,
      tone: 'calm',
      accentColor: '#435C4B',
      bgPillColor: 'rgba(218, 230, 220, 0.75)',
    };
  }
  return {
    value: clamped,
    category: 'Restorative Calm / Centered',
    description: 'Deeply rested, clear-minded, and grounded in tranquility.',
    stressLevel,
    tone: 'deep_calm',
    accentColor: '#364B3D',
    bgPillColor: 'rgba(218, 230, 220, 0.9)',
  };
}
