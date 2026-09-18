"""Deeper CBT-style probing question service (Phase 2 §2.0).

Per IMPLEMENTATION_PLAN.md §2.0:
  - When a trigger category recurs 3+ times in a rolling 14-day window:
  - Retrieve the user's 2-3 most similar past check-ins via cosine similarity
    (strictly scoped to that user_id only — retrieval never crosses users by construction).
  - Ground the NIM prompt in the user's actual past phrasing to generate
    ONE single reflective CBT-style question — never advice, never a diagnosis.
  - Fail-open guardrail: if NIM is unreachable, rate-limited, or times out,
    skip generating a question this cycle rather than blocking or delaying
    the check-in response.
"""
import logging
from datetime import timedelta
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session

from app.models import TriggerTag, Checkin, utc_now
from app.ai.nim_client import generate_chat_completion
from app.core.config import settings

logger = logging.getLogger(__name__)

CBT_SYSTEM_PROMPT = """You are an empathetic, reflective assistant grounded in Cognitive Behavioral Therapy (CBT) principles.
Your role is to help the user notice patterns in their thoughts and stressors by asking ONE single reflective question.

STRICT CLINICAL SAFETY RULES:
1. NEVER give advice, suggestions, or directives (do NOT say "try to", "you should", "consider", "I suggest").
2. NEVER provide a diagnosis or clinical label (do NOT say "you have anxiety/depression/burnout").
3. Output EXACTLY ONE reflective question. No greetings, no preamble, no commentary, no multiple questions.
4. Ground the question directly in the user's actual words and phrasing from their check-ins.
5. Focus on cognitive awareness: exploring recurring triggers, automatic thoughts, or how they interpret these situations."""


def check_category_recurrence(
    db: Session,
    user_id: str,
    category: str,
    window_days: int = 14,
) -> int:
    """Count how many times this trigger category appeared for this user
    in the rolling window_days. Scoped strictly to user_id.
    """
    cutoff = utc_now() - timedelta(days=window_days)
    count = (
        db.query(TriggerTag)
        .filter(
            TriggerTag.user_id == user_id,
            TriggerTag.category == category,
            TriggerTag.created_at >= cutoff,
        )
        .count()
    )
    return count


def _parse_embedding(emb: Any) -> Optional[List[float]]:
    """Helper to parse embeddings from various storage formats (JSON list, vector string, numpy)."""
    if emb is None:
        return None
    if isinstance(emb, list):
        return emb
    if isinstance(emb, str):
        import json
        try:
            return json.loads(emb)
        except Exception:
            # Handle pgvector string format "[0.1,0.2,...]"
            cleaned = emb.strip("[]")
            return [float(x.strip()) for x in cleaned.split(",") if x.strip()]
    if hasattr(emb, "tolist"):
        return emb.tolist()
    return None


def retrieve_similar_past_checkins(
    db: Session,
    user_id: str,
    target_embedding: List[float],
    current_checkin_id: Optional[str] = None,
    top_k: int = 3,
) -> List[Checkin]:
    """Retrieve the user's 2-3 most similar past check-ins using cosine similarity.

    PRIVACY & SECURITY GUARDRAIL:
    - Scoped strictly to `WHERE user_id = :user_id` at query level.
    - Retrieval NEVER crosses users, by construction, not just by policy.
    - Excludes the current check-in.
    - Only includes check-ins with non-empty free_text and valid embeddings.
    """
    if not target_embedding or not any(target_embedding):
        return []

    target_vec = np.array(target_embedding, dtype=np.float32)
    target_norm = np.linalg.norm(target_vec)
    if target_norm == 0:
        return []

    # Strict user isolation query
    query = (
        db.query(Checkin)
        .filter(
            Checkin.user_id == user_id,
            Checkin.embedding.isnot(None),
        )
    )
    if current_checkin_id:
        query = query.filter(Checkin.id != current_checkin_id)

    candidates = query.all()
    if not candidates:
        return []

    scored: List[tuple[float, Checkin]] = []
    for c in candidates:
        if not c.free_text or not c.free_text.strip():
            continue
        emb = _parse_embedding(c.embedding)
        if not emb:
            continue
        vec = np.array(emb, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            sim = float(np.dot(target_vec, vec) / (target_norm * norm))
            scored.append((sim, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]


def build_probing_messages(
    current_text: str,
    category: str,
    past_checkins: List[Checkin],
) -> List[Dict[str, str]]:
    """Build the chat completion prompt including user's actual phrasing."""
    past_phrasings = "\n".join(f'- "{c.free_text.strip()}"' for c in past_checkins)

    user_prompt = (
        f'The user has logged recurring stress around "{category}" (recurs 3+ times in the past 14 days).\n\n'
        f"User's past reflections:\n{past_phrasings}\n\n"
        f'User\'s current check-in:\n"{current_text.strip()}"\n\n'
        "Using their actual words and themes, ask ONE reflective CBT-style question to help them notice "
        "their thought patterns or recurring situation. Remember: NO advice, NO diagnosis, EXACTLY ONE question."
    )

    return [
        {"role": "system", "content": CBT_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]


def generate_probing_question(
    current_text: str,
    category: str,
    past_checkins: List[Checkin],
    api_key: str = "",
    base_url: str = "https://integrate.api.nvidia.com/v1",
    model: str = "deepseek-ai/deepseek-v4-pro-0813",
) -> Optional[str]:
    """Call NVIDIA NIM to generate a single reflective CBT-style question.
    Fails open: returns None if NIM fails, times out, or returns empty.
    """
    if not past_checkins:
        return None

    messages = build_probing_messages(current_text, category, past_checkins)

    try:
        response = generate_chat_completion(
            messages=messages,
            api_key=api_key or settings.NVIDIA_API_KEY,
            base_url=base_url or settings.NVIDIA_BASE_URL,
            model=model or settings.NVIDIA_MODEL,
            temperature=0.3,
            max_tokens=100,
            timeout=8.0,
        )
        if not response:
            return None

        question = response.strip().strip('"').strip("'")
        # Ensure it's a question
        if not question.endswith("?"):
            if "?" in question:
                question = question[:question.rfind("?") + 1].strip()
            else:
                question = question + "?"

        return question
    except Exception as e:
        logger.warning("Probing question generation failed (fail-open): %s", e)
        return None


def maybe_generate_probing_question(
    db: Session,
    user_id: str,
    current_checkin_id: str,
    current_text: str,
    category: str,
    target_embedding: List[float],
    min_recurrence: int = 3,
    window_days: int = 14,
) -> Optional[str]:
    """Check recurrence and generate a reflective question if threshold (3+) is met.

    Full pipeline:
    1. Check recurrence: category recurs >= 3 times in rolling 14-day window.
    2. Retrieve 2-3 most similar past check-ins (strictly scoped to user_id).
    3. Call NIM with actual phrasing.
    4. Fail open on any error or timeout (never blocks check-in).
    """
    try:
        count = check_category_recurrence(db, user_id, category, window_days)
        if count < min_recurrence:
            return None

        past_checkins = retrieve_similar_past_checkins(
            db=db,
            user_id=user_id,
            target_embedding=target_embedding,
            current_checkin_id=current_checkin_id,
            top_k=3,
        )

        if not past_checkins:
            return None

        question = generate_probing_question(
            current_text=current_text,
            category=category,
            past_checkins=past_checkins,
            api_key=settings.NVIDIA_API_KEY,
            base_url=settings.NVIDIA_BASE_URL,
            model=settings.NVIDIA_MODEL,
        )
        return question
    except Exception as e:
        logger.warning("maybe_generate_probing_question failed (fail-open): %s", e)
        return None
