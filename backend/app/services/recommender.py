"""Relief technique library and recommendations.
Per IMPLEMENTATION_PLAN.md §0.2 (relief_sessions) and STITCH_DESIGN_BRIEF.md.
"""
from typing import List, Dict, Any

TECHNIQUES = [
    {
        "id": "square_breathing",
        "name": "Square Breathing (Box Breathing)",
        "duration_seconds": 120,
        "description": "Four equal counts of inhale, hold, exhale, hold. Physiologically slows heart rate and resets the nervous system.",
        "pacing": {
            "inhale_seconds": 4,
            "hold_after_inhale_seconds": 4,
            "exhale_seconds": 4,
            "hold_after_exhale_seconds": 4
        },
        "guidance_script": [
            "Inhale deeply through your nose as the circle expands (4s)...",
            "Hold your breath gently at the top (4s)...",
            "Slowly exhale through your mouth as the circle contracts (4s)...",
            "Hold comfortably empty at the bottom (4s)..."
        ]
    },
    {
        "id": "grounding_54321",
        "name": "5-4-3-2-1 Sensory Grounding",
        "duration_seconds": 180,
        "description": "Engage all five senses to anchor your attention away from racing thoughts and back into the physical present.",
        "pacing": {
            "step_seconds": 30
        },
        "guidance_script": [
            "Acknowledge 5 things you can see around you right now.",
            "Acknowledge 4 things you can physically feel with your body.",
            "Acknowledge 3 sounds you can hear in your environment.",
            "Acknowledge 2 scents you can smell.",
            "Acknowledge 1 taste in your mouth or take a sip of water."
        ]
    },
    {
        "id": "micro_meditation",
        "name": "3-Minute Somatic Pause",
        "duration_seconds": 180,
        "description": "A calm, unhurried check with your posture, softening physical tension in the jaw, shoulders, and brow.",
        "pacing": {
            "step_seconds": 45
        },
        "guidance_script": [
            "Allow your shoulders to drop away from your ears.",
            "Unclench your jaw and soften the muscles around your eyes.",
            "Feel the contact of your feet resting on the floor.",
            "Take three natural, easy breaths without trying to change them."
        ]
    }
]

def get_all_techniques() -> List[Dict[str, Any]]:
    return TECHNIQUES

def get_technique_by_id(tech_id: str) -> Dict[str, Any]:
    for t in TECHNIQUES:
        if t["id"] == tech_id:
            return t
    return TECHNIQUES[0]
