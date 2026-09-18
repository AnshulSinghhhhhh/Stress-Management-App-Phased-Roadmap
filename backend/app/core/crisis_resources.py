"""Centralized, verified crisis helpline numbers and emergency resources for India.
Per SOP_ANTIGRAVITY.md §6 and IMPLEMENTATION_PLAN.md §0.4:
- All helpline resources must be defined in this single configuration file.
- Never hardcode these resources in multiple places.
- Re-verify against official Govt of India sources before each production deploy.
"""
from typing import List, Dict, Any

CRISIS_DETECTOR_VERSION = "1.0.0-phase1-deterministic"

INDIA_CRISIS_RESOURCES: List[Dict[str, Any]] = [
    {
        "id": "tele_manas",
        "name": "Tele MANAS",
        "full_name": "Tele Mental Health Assistance and Nationally Actionable Plan through States",
        "number": "14416",
        "alt_number": "1-800-891-4416",
        "description": "Govt of India 24/7 national mental health helpline. Free, confidential, and available in multiple Indian languages.",
        "is_emergency": True,
        "tap_to_call": "tel:14416",
        "provider": "Ministry of Health and Family Welfare (MoHFW), Govt of India"
    },
    {
        "id": "kiran",
        "name": "KIRAN Helpline",
        "full_name": "KIRAN Mental Health Helpline",
        "number": "1800-599-0019",
        "alt_number": None,
        "description": "Govt of India 24/7 helpline providing psychological support, mental health first-aid, and crisis management in 13 languages.",
        "is_emergency": True,
        "tap_to_call": "tel:18005990019",
        "provider": "Department of Empowerment of Persons with Disabilities, Govt of India"
    },
    {
        "id": "emergency_112",
        "name": "Emergency Services",
        "full_name": "National Emergency Support System",
        "number": "112",
        "alt_number": None,
        "description": "All-in-one national emergency response number across India for police, medical, and immediate emergency intervention.",
        "is_emergency": True,
        "tap_to_call": "tel:112",
        "provider": "Govt of India"
    }
]

SUPPORTIVE_COPY = {
    "headline": "You are not alone. Immediate support is here for you.",
    "message": "We noticed you might be in deep distress. Free, confidential, professional human counselors are ready to speak with you right now.",
    "subtext": "No login required. Reaching out takes courage, and support is available 24 hours a day."
}

def get_crisis_payload() -> Dict[str, Any]:
    """Standardized crisis resources payload."""
    return {
        "crisis_detected": True,
        "detector_version": CRISIS_DETECTOR_VERSION,
        "copy": SUPPORTIVE_COPY,
        "resources": INDIA_CRISIS_RESOURCES
    }
