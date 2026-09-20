import { describe, it, expect } from 'vitest';
import {
  getMoodScaleDescriptor,
  SCALE_CONVENTION,
  ScaleTone,
} from '../moodScale';

describe('MoodScale Polarity & Descriptor Invariants (v2.3 Regression Test)', () => {
  it('enforces definitive convention: 1 = Highest Tension, 10 = Most Calm', () => {
    expect(SCALE_CONVENTION.MIN_VALUE).toBe(1);
    expect(SCALE_CONVENTION.MAX_VALUE).toBe(10);
    expect(SCALE_CONVENTION.MIN_LABEL).toBe('Highest Tension');
    expect(SCALE_CONVENTION.MAX_LABEL).toBe('Most Calm');
    expect(SCALE_CONVENTION.INLINE_CAPTION).toBe('1 = Highest Tension, 10 = Most Calm');
  });

  it('correctly maps boundary value 1 to highest tension and highest stress (90)', () => {
    const desc = getMoodScaleDescriptor(1);
    expect(desc.value).toBe(1);
    expect(desc.category).toMatch(/tension|depleted/i);
    expect(desc.tone).toBe('high_tension');
    expect(desc.stressLevel).toBe(90);
  });

  it('correctly maps midpoint value 5 to balanced / steady (stress 50)', () => {
    const desc = getMoodScaleDescriptor(5);
    expect(desc.value).toBe(5);
    expect(desc.category).toMatch(/balanced|steady/i);
    expect(desc.tone).toBe('steady');
    expect(desc.stressLevel).toBe(50);
  });

  it('CRITICAL REGRESSION: value of 9 MUST render calm/positive label, NEVER high tension/overwhelmed', () => {
    const desc = getMoodScaleDescriptor(9);
    expect(desc.value).toBe(9);
    // Explicit assertion protecting against the inverted copy bug
    expect(desc.category).not.toMatch(/tension|overwhelmed|depleted/i);
    expect(desc.category).toMatch(/calm|centered|restorative/i);
    expect(desc.tone).toBe('deep_calm');
    expect(desc.stressLevel).toBe(10);
  });

  it('correctly maps top value 10 to restorative calm and lowest stress (0)', () => {
    const desc = getMoodScaleDescriptor(10);
    expect(desc.value).toBe(10);
    expect(desc.category).toMatch(/calm|centered|restorative/i);
    expect(desc.tone).toBe('deep_calm');
    expect(desc.stressLevel).toBe(0);
  });

  it('asserts strictly monotonic stress reduction from rating 1 to 10', () => {
    const stressLevels: number[] = [];
    for (let r = 1; r <= 10; r++) {
      const desc = getMoodScaleDescriptor(r);
      stressLevels.push(desc.stressLevel);
    }

    // Stress levels must decrease strictly monotonically: 90, 80, 70, ..., 0
    for (let i = 0; i < stressLevels.length - 1; i++) {
      expect(stressLevels[i]).toBeGreaterThan(stressLevels[i + 1]);
    }
  });

  it('asserts tone progression moves monotonically from tension towards calm', () => {
    const toneOrder: Record<ScaleTone, number> = {
      high_tension: 0,
      elevated_tension: 1,
      steady: 2,
      calm: 3,
      deep_calm: 4,
    };

    let prevToneRank = -1;
    for (let r = 1; r <= 10; r++) {
      const desc = getMoodScaleDescriptor(r);
      const currentRank = toneOrder[desc.tone];
      expect(currentRank).toBeGreaterThanOrEqual(prevToneRank);
      prevToneRank = currentRank;
    }
  });
});
