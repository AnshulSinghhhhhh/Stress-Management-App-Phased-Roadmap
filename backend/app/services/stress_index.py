"""Stress index calculation algorithm.
Per IMPLEMENTATION_PLAN.md §0.2 & Phase 1.
Computes daily stress score (0.00 - 100.00) from contributing check-ins.
"""
from typing import List, Dict, Any
from datetime import date

def calculate_stress_score(mood_score: int) -> float:
    """Converts a 1-10 mood rating to a 0-100 stress score.
    1 (Very low / highest stress) -> 100.00
    5 (Steady / balanced)         -> 50.00
    10 (Radiant / thriving)       -> 0.00
    """
    clamped = max(1, min(10, mood_score))
    return round((10.0 - clamped) * 11.11, 2)

def aggregate_daily_stress(checkins: List[Dict[str, Any]]) -> float:
    """Aggregates multiple check-ins on the same day into a balanced daily score."""
    if not checkins:
        return 50.00
    scores = [calculate_stress_score(c.get("mood_score", 5)) for c in checkins]
    return round(sum(scores) / len(scores), 2)
