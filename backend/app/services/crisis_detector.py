"""Crisis detector service.
Per IMPLEMENTATION_PLAN.md §0.4 and SOP_ANTIGRAVITY.md §6:
1. Deterministic keyword/regex matcher is the primary, zero-cost, zero-latency first line (<50ms).
2. NVIDIA NIM model is an advisory secondary pass that NEVER blocks or delays the critical response.
3. Guardrails: No update/delete, append-only to crisis_events.
"""
import re
import time
from typing import Tuple, Optional, Dict, Any
from app.core.crisis_resources import CRISIS_DETECTOR_VERSION, get_crisis_payload
from app.core.config import settings

# Reviewed deterministic list of crisis, self-harm, and severe distress trigger patterns
CRISIS_KEYWORD_PATTERNS = [
    r"\b(?:kill|end|take)\s+(?:my|myself|my\s+own)\s+life\b",
    r"\bkill\s+myself\b",
    r"\bcommit\s+suicide\b",
    r"\bwant\s+to\s+die\b",
    r"\brather\s+be\s+dead\b",
    r"\bdon'?t\s+want\s+to\s+(?:live|wake\s+up|exist)\s+anymore\b",
    r"\bself[- ]?harm\b",
    r"\bcutting\s+(?:myself|my\s+wrists)\b",
    r"\bslit\s+my\s+wrists?\b",
    r"\boverdose\b",
    r"\bhang\s+myself\b",
    r"\bjump\s+off\s+(?:a\s+bridge|the\s+roof|a\s+building)\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bend\s+it\s+all\b",
    r"\bcan'?t\s+go\s+on\s+anymore\b",
    r"\bsuicidal\b"
]

_COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in CRISIS_KEYWORD_PATTERNS]

class CrisisDetector:
    """Safety-critical dual-layer crisis detector."""
    
    @staticmethod
    def detect_deterministic(text: str) -> Tuple[bool, Optional[str]]:
        """Layer 1: Deterministic regex/keyword evaluation.
        Always executes in <50ms with zero network calls.
        """
        if not text or not text.strip():
            return False, None
            
        clean = text.strip()
        for pattern in _COMPILED_PATTERNS:
            match = pattern.search(clean)
            if match:
                return True, match.group(0)
        return False, None

    @staticmethod
    def check_crisis(text: Optional[str]) -> Dict[str, Any]:
        """Synchronous crisis evaluation pipeline.
        Executes Layer 1 immediately. Returns resources in the same response if triggered.
        """
        start_time = time.time()
        triggered = False
        matched_trigger = None
        
        if text:
            triggered, matched_trigger = CrisisDetector.detect_deterministic(text)
            
        elapsed_ms = (time.time() - start_time) * 1000
        
        if triggered:
            payload = get_crisis_payload()
            payload["triggered_by"] = matched_trigger
            payload["detection_latency_ms"] = round(elapsed_ms, 2)
            return payload
            
        return {
            "crisis_detected": False,
            "detector_version": CRISIS_DETECTOR_VERSION,
            "detection_latency_ms": round(elapsed_ms, 2)
        }

crisis_detector = CrisisDetector()
