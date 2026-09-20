"""Calibrated Stress Indicator and Longitudinal Metrics Service.
Per IMPLEMENTATION_PLAN.md Section 4 & Step 7.
- Exponential recency decay (tau = 3.5 days / 84h)
- Kish's Effective Sample Size (N_eff)
- Margin of Error & Statistical Confidence Score (0.0 to 1.0)
- Distinct-days minimum-N rule (D_distinct < 5 calibrating, 5-6 preliminary, >=7 calibrated)
- Deterministic Factor Attribution on locked 7-category taxonomy (zero LLM hallucinations)
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date, timezone, timedelta
import math
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Checkin, TriggerTag, BaselineSnapshot, utc_now
from app.schemas import VALID_TRIGGER_CATEGORIES, ContributingFactor

HALF_LIFE_DAYS = 3.5
HALF_LIFE_HOURS = 84.0
TOLERANCE_POINTS = 12.5  # Acceptable margin of error on 100-point scale
Z_90 = 1.645             # 90% confidence two-sided z-score
DEFAULT_POPULATION_VARIANCE = 225.0  # std dev = 15.0 on 0-100 scale

def get_circadian_bucket(dt: datetime, tz_offset_minutes: int = 0) -> str:
    """Classifies local time into diurnal buckets."""
    local_time = dt + timedelta(minutes=tz_offset_minutes)
    hour = local_time.hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 22:
        return "evening"
    else:
        return "night"

def compute_raw_stress_score(mood_score: int, emotional_tags: Optional[List[str]] = None) -> float:
    """Converts 1-10 mood rating and emotional tags to 0.00-100.00 stress score."""
    clamped_mood = max(1, min(10, mood_score))
    base = (10.0 - clamped_mood) * 11.11

    # Somatic emotional tag nuances (+/- subtle adjustments)
    tag_adjustment = 0.0
    if emotional_tags:
        lower_tags = {t.lower().strip() for t in emotional_tags}
        if "overwhelmed" in lower_tags:
            tag_adjustment += 4.0
        if "anxious" in lower_tags:
            tag_adjustment += 3.0
        if "restless" in lower_tags:
            tag_adjustment += 2.0
        if "tired" in lower_tags:
            tag_adjustment += 1.5
        if "calm" in lower_tags:
            tag_adjustment -= 3.0
        if "grateful" in lower_tags:
            tag_adjustment -= 3.0
        if "hopeful" in lower_tags:
            tag_adjustment -= 2.0
        if "focused" in lower_tags:
            tag_adjustment -= 2.0

    final_score = max(0.00, min(100.00, base + tag_adjustment))
    return round(final_score, 2)

def make_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def calculate_recency_weight(event_time: datetime, now_time: datetime) -> float:
    """Calculates exponential decay weight w_i = 2^(-delta_hours / 84)."""
    e_aware = make_aware(event_time)
    n_aware = make_aware(now_time)
    delta_hours = max(0.0, (n_aware - e_aware).total_seconds() / 3600.0)
    return math.pow(2.0, - (delta_hours / HALF_LIFE_HOURS))

def compute_calibrated_metrics_for_user(
    db: Session,
    user_id: str,
    window_days: int = 14,
    reference_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """Computes calibrated stress indicator, confidence, and distinct day counts."""
    now = reference_time or utc_now()
    cutoff = now - timedelta(days=window_days)

    # Fetch all check-ins for the user in the window
    checkins: List[Checkin] = (
        db.query(Checkin)
        .filter(Checkin.user_id == user_id, Checkin.created_at >= cutoff)
        .order_by(Checkin.created_at.asc())
        .all()
    )

    if not checkins:
        return {
            "status": "calibrating",
            "current_score": 50.0,
            "confidence_score": 0.0,
            "effective_sample_size": 0.0,
            "distinct_days": 0,
            "minimum_n_met": False,
            "trend_direction": None,
            "trend_slope": 0.0,
            "status_copy": "No check-ins yet. Complete your first check-in to begin calibration.",
            "contributing_factors": [],
            "recommended_action": {
                "technique": "square_breathing",
                "title": "4-4-4-4 Box Breathing",
                "reason": "Gentle baseline reset for your nervous system."
            }
        }

    # Group by distinct calendar days (user local date)
    distinct_dates = set()
    observations: List[Tuple[datetime, float, float, str]] = []  # (time, score, weight, checkin_id)

    for c in checkins:
        local_date = (c.created_at + timedelta(minutes=c.user_tz_offset_minutes or 0)).date()
        distinct_dates.add(local_date)

        score = compute_raw_stress_score(c.mood_score, c.emotional_tags)
        weight = calculate_recency_weight(c.created_at, now)
        observations.append((c.created_at, score, weight, c.id))

    distinct_days_count = len(distinct_dates)

    sum_weights = sum(w for _, _, w, _ in observations)
    sum_weights_sq = sum(w * w for _, _, w, _ in observations)

    if sum_weights <= 0:
        n_eff = 0.0
        weighted_mean = 50.0
        confidence = 0.0
    else:
        # Kish's Effective Sample Size
        n_eff = round((sum_weights * sum_weights) / max(1e-6, sum_weights_sq), 2)
        weighted_mean = round(sum(w * score for _, score, w, _ in observations) / sum_weights, 2)

        # Weighted sample variance
        if len(observations) > 1 and sum_weights > sum_weights_sq / sum_weights:
            variance_denom = sum_weights - (sum_weights_sq / sum_weights)
            weighted_var = sum(w * math.pow(score - weighted_mean, 2) for _, score, w, _ in observations) / variance_denom
        else:
            weighted_var = DEFAULT_POPULATION_VARIANCE

        effective_var = max(weighted_var, DEFAULT_POPULATION_VARIANCE / max(1.0, n_eff))
        se_w = math.sqrt(effective_var / max(1.0, n_eff))
        margin_of_error = Z_90 * se_w

        # Confidence: clamp(1 - MoE / TOLERANCE_POINTS, 0.0, 1.0)
        confidence = max(0.0, min(1.0, round(1.0 - (margin_of_error / TOLERANCE_POINTS), 3)))

    # Evaluate Minimum-N Rule
    # D_distinct < 5: calibrating (hide trend)
    # D_distinct = 5-6: preliminary
    # D_distinct >= 7: calibrated (full trends unlocked)
    if distinct_days_count < 5:
        status = "calibrating"
        minimum_n_met = False
        status_copy = f"Calibrating your baseline (Day {distinct_days_count} of 5 distinct days)"
    elif distinct_days_count < 7:
        status = "preliminary"
        minimum_n_met = False
        status_copy = f"Preliminary baseline (Day {distinct_days_count} of 7 distinct days)"
    else:
        status = "calibrated"
        minimum_n_met = True
        status_copy = "Calibrated baseline active"

    # Compute trend slope & direction (if D_distinct >= 5)
    trend_direction = None
    trend_slope = 0.0
    if distinct_days_count >= 5 and len(observations) >= 5:
        # Daily averages for regression
        daily_scores: Dict[date, List[float]] = {}
        for c in checkins:
            ld = (c.created_at + timedelta(minutes=c.user_tz_offset_minutes or 0)).date()
            daily_scores.setdefault(ld, []).append(compute_raw_stress_score(c.mood_score, c.emotional_tags))

        sorted_dates = sorted(daily_scores.keys())
        days_x = [(d - sorted_dates[0]).days for d in sorted_dates]
        scores_y = [sum(scores)/len(scores) for scores in (daily_scores[d] for d in sorted_dates)]

        n_pts = len(days_x)
        if n_pts >= 3:
            mean_x = sum(days_x) / n_pts
            mean_y = sum(scores_y) / n_pts
            denom = sum(math.pow(x - mean_x, 2) for x in days_x)
            if denom > 0:
                slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(days_x, scores_y)) / denom
                trend_slope = round(slope, 2)
                if slope > 1.2:
                    trend_direction = "rising"
                elif slope < -1.2:
                    trend_direction = "easing"
                else:
                    trend_direction = "stable"

    # Deterministic Factor Attribution on locked 7-category taxonomy
    contributing_factors = compute_deterministic_factors(db, user_id, cutoff, observations)

    # Next recommended somatic action based on score and factors
    recommended_action = select_recommended_action(weighted_mean, contributing_factors)

    return {
        "user_id": user_id,
        "status": status,
        "current_score": weighted_mean,
        "confidence_score": confidence,
        "effective_sample_size": n_eff,
        "distinct_days": distinct_days_count,
        "minimum_n_met": minimum_n_met,
        "trend_direction": trend_direction if minimum_n_met else None,
        "trend_slope": trend_slope if minimum_n_met else 0.0,
        "status_copy": status_copy,
        "contributing_factors": contributing_factors,
        "recommended_action": recommended_action
    }

def compute_deterministic_factors(
    db: Session,
    user_id: str,
    cutoff: datetime,
    observations: List[Tuple[datetime, float, float, str]]
) -> List[ContributingFactor]:
    """Computes mathematically grounded factor contributions across the locked 7 taxonomy."""
    if not observations:
        return []

    # Map checkin_id -> (score, weight)
    obs_map = {chk_id: (score, weight) for _, score, weight, chk_id in observations}
    all_checkin_ids = list(obs_map.keys())

    # Query all TriggerTags for these check-ins
    tags = (
        db.query(TriggerTag)
        .filter(TriggerTag.checkin_id.in_(all_checkin_ids))
        .all()
    )

    # Group checkin_ids by category
    category_checkins: Dict[str, set] = {cat: set() for cat in VALID_TRIGGER_CATEGORIES}
    for t in tags:
        if t.category in category_checkins:
            category_checkins[t.category].add(t.checkin_id)

    total_weight = sum(w for _, _, w, _ in observations)
    factors_raw: List[Dict[str, Any]] = []

    for cat in VALID_TRIGGER_CATEGORIES:
        present_ids = category_checkins[cat]
        if not present_ids:
            continue

        # Weighted frequency
        weight_present = sum(obs_map[cid][1] for cid in present_ids if cid in obs_map)
        weighted_freq = weight_present / max(1e-6, total_weight)

        # Mean stress present
        sum_score_present = sum(obs_map[cid][0] * obs_map[cid][1] for cid in present_ids if cid in obs_map)
        mean_present = sum_score_present / max(1e-6, weight_present)

        # Mean stress absent
        absent_ids = [cid for cid in all_checkin_ids if cid not in present_ids]
        weight_absent = sum(obs_map[cid][1] for cid in absent_ids)
        if weight_absent > 0:
            sum_score_absent = sum(obs_map[cid][0] * obs_map[cid][1] for cid in absent_ids)
            mean_absent = sum_score_absent / weight_absent
        else:
            mean_absent = mean_present

        lift = max(0.0, mean_present - mean_absent)
        impact_score = weighted_freq * (lift + 2.0)

        deterministic_reason = (
            f"Tagged in {len(present_ids)} check-in{'s' if len(present_ids) > 1 else ''}. "
            f"Associated with an average stress score of {mean_present:.1f}/100 "
            f"({'+' if lift > 0 else ''}{lift:.1f} vs other days)."
        )

        factors_raw.append({
            "category": cat,
            "weighted_frequency": round(weighted_freq, 3),
            "mean_stress_present": round(mean_present, 1),
            "mean_stress_absent": round(mean_absent, 1),
            "lift": round(lift, 1),
            "impact_score": impact_score,
            "evidence_checkin_ids": list(present_ids)[:5],
            "deterministic_reason": deterministic_reason
        })

    if not factors_raw:
        return []

    # Sort descending by impact score
    factors_raw.sort(key=lambda x: x["impact_score"], reverse=True)
    sum_impact = sum(f["impact_score"] for f in factors_raw) or 1.0

    results: List[ContributingFactor] = []
    for f in factors_raw[:4]:
        pct = round((f["impact_score"] / sum_impact) * 100.0, 1)
        results.append(ContributingFactor(
            category=f["category"],
            contribution_pct=pct,
            weighted_frequency=f["weighted_frequency"],
            mean_stress_present=f["mean_stress_present"],
            mean_stress_absent=f["mean_stress_absent"],
            lift=f["lift"],
            evidence_checkin_ids=f["evidence_checkin_ids"],
            deterministic_reason=f["deterministic_reason"]
        ))

    return results

def select_recommended_action(stress_score: float, factors: List[ContributingFactor]) -> Dict[str, Any]:
    """Deterministically selects recommended somatic technique without LLM guessing."""
    top_cat = factors[0].category if factors else None

    if top_cat == "sleep":
        return {
            "technique": "micro_meditation",
            "title": "3-Minute Somatic Wind-Down",
            "reason": "Sleep was identified as a primary contributor in your recent logs."
        }
    elif stress_score >= 65.0:
        return {
            "technique": "square_breathing",
            "title": "4-4-4-4 Box Breathing",
            "reason": "Calibrated stress is elevated. Paced respiration rapidly down-regulates sympathetic activation."
        }
    elif stress_score >= 40.0:
        return {
            "technique": "grounding_54321",
            "title": "5-4-3-2-1 Sensory Grounding",
            "reason": "Moderate mental tension observed. Re-orients focus from thoughts to physical surroundings."
        }
    else:
        return {
            "technique": "micro_meditation",
            "title": "3-Minute Somatic Pause",
            "reason": "Nervous system is balanced. A brief pause preserves centered stability."
        }
