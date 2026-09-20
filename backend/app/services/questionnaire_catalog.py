"""Questionnaire catalog and validated scale scoring service.
Per IMPLEMENTATION_PLAN.md Section 4 & Step 3.
- WHO-5 Adapted Subjective Well-Being & Stress Index (Periodic Anchor)
- Qualitative Somatic Lifestyle Profile
- Normalization: Baseline Stress = 100 - WellBeing%
"""
from typing import Dict, Any, List

ACTIVE_QUESTIONNAIRE_VERSION = "2.0.0"
ACTIVE_SCALE_VERSION = "2.0.0"

# Part A: Validated Well-Being Index (Modeled on WHO-5, 0 to 5 response scale)
WHO5_ADAPTED_ITEMS = [
    {
        "id": "who5_cheerful",
        "prompt": "Over the last two weeks, I have felt cheerful and in good spirits.",
        "dimension": "positive_mood",
        "options": [
            {"score": 0, "label": "At no time"},
            {"score": 1, "label": "Some of the time"},
            {"score": 2, "label": "Less than half the time"},
            {"score": 3, "label": "More than half the time"},
            {"score": 4, "label": "Most of the time"},
            {"score": 5, "label": "All of the time"}
        ]
    },
    {
        "id": "who5_calm",
        "prompt": "Over the last two weeks, I have felt calm and relaxed.",
        "dimension": "parasympathetic_calm",
        "options": [
            {"score": 0, "label": "At no time"},
            {"score": 1, "label": "Some of the time"},
            {"score": 2, "label": "Less than half the time"},
            {"score": 3, "label": "More than half the time"},
            {"score": 4, "label": "Most of the time"},
            {"score": 5, "label": "All of the time"}
        ]
    },
    {
        "id": "who5_active",
        "prompt": "Over the last two weeks, I have felt active and vigorous.",
        "dimension": "vitality_energy",
        "options": [
            {"score": 0, "label": "At no time"},
            {"score": 1, "label": "Some of the time"},
            {"score": 2, "label": "Less than half the time"},
            {"score": 3, "label": "More than half the time"},
            {"score": 4, "label": "Most of the time"},
            {"score": 5, "label": "All of the time"}
        ]
    },
    {
        "id": "who5_rested",
        "prompt": "Over the last two weeks, I woke up feeling fresh and rested.",
        "dimension": "restorative_sleep",
        "options": [
            {"score": 0, "label": "At no time"},
            {"score": 1, "label": "Some of the time"},
            {"score": 2, "label": "Less than half the time"},
            {"score": 3, "label": "More than half the time"},
            {"score": 4, "label": "Most of the time"},
            {"score": 5, "label": "All of the time"}
        ]
    },
    {
        "id": "who5_interest",
        "prompt": "Over the last two weeks, my daily life has been filled with things that interest me.",
        "dimension": "cognitive_interest",
        "options": [
            {"score": 0, "label": "At no time"},
            {"score": 1, "label": "Some of the time"},
            {"score": 2, "label": "Less than half the time"},
            {"score": 3, "label": "More than half the time"},
            {"score": 4, "label": "Most of the time"},
            {"score": 5, "label": "All of the time"}
        ]
    }
]

# Part B: Qualitative Somatic Baseline Questions
SOMATIC_BASELINE_ITEMS = [
    {
        "id": "physical_manifestation",
        "prompt": "How does stress typically show up in your physical body?",
        "options": [
            "Tightness in shoulders & neck",
            "Shallow chest breathing",
            "Clenched jaw or furrowed brow",
            "Stomach knots or digestive tension",
            "General heavy fatigue & low energy"
        ]
    },
    {
        "id": "sleep_quality",
        "prompt": "How would you describe your natural sleep pattern lately?",
        "options": [
            "Generally sound and restorative",
            "Racing mind when trying to fall asleep",
            "Waking up frequently throughout the night",
            "Waking up tired even after 8 hours",
            "Irregular hours and light restless rest"
        ]
    },
    {
        "id": "daily_support",
        "prompt": "What usually offers you the most reliable sense of grounding?",
        "options": [
            "Quiet solitary walk or movement",
            "Unstructured breathing and stillness",
            "Talking with a trusted friend or partner",
            "Listening to calming ambient sound or music",
            "Writing or journaling thoughts down"
        ]
    },
    {
        "id": "peak_hours",
        "prompt": "When during the day does mental strain tend to accumulate most?",
        "options": [
            "Morning arrival and planning (8 AM - 11 AM)",
            "Mid-afternoon energy drop (2 PM - 5 PM)",
            "Late evening wind-down (8 PM - 11 PM)",
            "Unpredictable, shifting from day to day"
        ]
    },
    {
        "id": "welcome_technique",
        "prompt": "What style of intervention feels most restful for you?",
        "options": [
            "4-4-4-4 Box Breathing (Paced physiological reset)",
            "5-4-3-2-1 Sensory Grounding (Physical room re-orientation)",
            "3-Minute Somatic Pause (Progressive muscular release)",
            "Silent unguided timer with soft bell"
        ]
    }
]

def get_active_questionnaire_catalog() -> Dict[str, Any]:
    """Returns the full active questionnaire catalog."""
    return {
        "questionnaire_version": ACTIVE_QUESTIONNAIRE_VERSION,
        "scale_version": ACTIVE_SCALE_VERSION,
        "disclaimer": "The stress indicator is an estimate informed by validated well-being instruments; it is not a medical or clinical diagnosis.",
        "baseline_anchor": {
            "scale_name": "who5_adapted",
            "recall_window": "Past two weeks",
            "items": WHO5_ADAPTED_ITEMS
        },
        "somatic_profile": {
            "items": SOMATIC_BASELINE_ITEMS
        }
    }

def score_baseline_responses(answers: Dict[str, Any]) -> float:
    """Calculates normalized baseline stress score (0.00 to 100.00).
    Normalized Baseline Stress = 100 - (WHO5_raw / 25.0 * 100).
    """
    total_raw = 0.0
    scored_items_count = 0

    for item in WHO5_ADAPTED_ITEMS:
        item_id = item["id"]
        if item_id in answers:
            val = answers[item_id]
            try:
                numeric_val = float(val)
                total_raw += max(0.0, min(5.0, numeric_val))
                scored_items_count += 1
            except (ValueError, TypeError):
                pass

    if scored_items_count == 0:
        return 50.00

    max_possible = scored_items_count * 5.0
    wellbeing_pct = (total_raw / max_possible) * 100.0
    baseline_stress = round(max(0.00, min(100.00, 100.0 - wellbeing_pct)), 2)
    return baseline_stress
