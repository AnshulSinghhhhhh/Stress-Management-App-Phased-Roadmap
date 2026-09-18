"""Trigger taxonomy classifier (Phase 2 §2.0).

Architecture (per IMPLEMENTATION_PLAN.md §2.0 NLP table):
  - Primary: local sentence-transformers/all-MiniLM-L6-v2 embedding model
    compares check-in text against few-shot examples per category via cosine
    similarity. CPU-only, no API call, no rate limits.
  - Fallback: NIM LLM call ONLY when local confidence < threshold.
  - Guardrail: if NIM is unreachable, local classification always completes.
    Trigger tagging must NEVER fail or block a check-in.

The 7 trigger categories:
  work, financial, relationship, health, sleep, social_loneliness, identity
"""
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import requests

logger = logging.getLogger(__name__)

# ── Lazy-loaded singleton for the embedding model ──────────────────────────
_model = None

def _get_model():
    """Lazy-load sentence-transformers model. ~100MB download on first run."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _model


def compute_embedding(text: str) -> List[float]:
    """Compute a 384-dim embedding for the given text.
    Used for both trigger classification AND pgvector storage (one call, two jobs).
    """
    if not text or not text.strip():
        return [0.0] * 384
    model = _get_model()
    vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return vec.tolist()


# ── 7 trigger categories with few-shot examples ───────────────────────────
# Canonical taxonomy: work, financial, relationship, health, sleep, social_loneliness, identity.
# User corrections get appended at runtime (append_user_example), improving accuracy.
TRIGGER_CATEGORIES: Dict[str, List[str]] = {
    "work": [
        "My manager piled on three urgent deadlines at once.",
        "I have back-to-back meetings all day with no breaks.",
        "I'm worried I'll be fired for missing the quarterly target.",
        "I stayed at the office until midnight again finishing work.",
        "Coworkers dumped their workload and tasks on me.",
    ],
    "financial": [
        "I can't make rent this month and have no savings left.",
        "Credit card debt keeps growing and I feel trapped.",
        "Unexpected medical bills wiped out my emergency fund.",
        "I'm terrified about affording my loan and mortgage payments.",
        "Prices keep rising but my salary and income haven't changed.",
    ],
    "relationship": [
        "My partner and I had a huge argument last night.",
        "I feel unsupported by my family and spouse when I need them most.",
        "My partner and I are not communicating well lately.",
        "Arguments with family members about personal choices are exhausting.",
        "My spouse and I cannot seem to agree on anything.",
    ],
    "health": [
        "I keep worrying that my headaches and physical symptoms are something serious.",
        "I haven't been to the doctor in years and I'm scared to go for a checkup.",
        "My chronic pain and illness makes even simple daily tasks exhausting.",
        "I'm anxious about getting a medical diagnosis and test result.",
        "I feel physically sick, fatigued, and drained no matter how much I rest.",
    ],
    "sleep": [
        "I haven't slept more than four hours in a week.",
        "I keep waking up at 3 AM and can't fall back asleep.",
        "My mind races every night when I lie down in bed.",
        "I'm exhausted during the day but wired at night with insomnia.",
        "Insomnia is ruining my ability to function and sleep restfully.",
    ],
    "social_loneliness": [
        "I feel so lonely and isolated from everyone around me.",
        "My friends are hanging out and doing things without inviting me.",
        "I don't have anyone I can truly open up to, talk with, or call a friend.",
        "I feel like an outsider and outcast in my social circle.",
        "Making new friends feels impossible and I spend all my weekends completely alone.",
    ],
    "identity": [
        "I don't know who I am anymore or what my purpose in life is.",
        "I feel like a fraud and imposter in everything I do.",
        "I've lost touch with my values, self-worth, and what truly matters to me.",
        "I'm having an identity crisis about my life direction and worth.",
        "I feel completely disconnected from my own identity and who I used to be.",
    ],
}

# Pre-computed category centroids (computed lazily)
_category_embeddings: Optional[Dict[str, np.ndarray]] = None

def _get_category_embeddings() -> Dict[str, np.ndarray]:
    """Compute and cache mean embedding for each category's examples."""
    global _category_embeddings
    if _category_embeddings is not None:
        return _category_embeddings

    model = _get_model()
    _category_embeddings = {}
    for category, examples in TRIGGER_CATEGORIES.items():
        vecs = model.encode(examples, convert_to_numpy=True, normalize_embeddings=True)
        _category_embeddings[category] = np.mean(vecs, axis=0)
    return _category_embeddings


def append_user_example(category: str, text: str):
    """Append a user-corrected example and invalidate the centroid cache.
    Per §2.0: user corrections get appended to the few-shot set,
    improving accuracy over time with no retraining step.
    """
    global _category_embeddings
    if category in TRIGGER_CATEGORIES:
        TRIGGER_CATEGORIES[category].append(text)
        _category_embeddings = None  # Force recompute


# ── Confidence threshold for NIM fallback ──────────────────────────────────
CONFIDENCE_THRESHOLD = 0.35


def classify_local(text: str, embedding: Optional[List[float]] = None) -> Tuple[str, float]:
    """Classify text into one of 7 trigger categories using local embeddings.

    Returns (category, confidence) where confidence is cosine similarity.
    If embedding is already computed, pass it in to avoid duplicate work.
    """
    if not text or not text.strip():
        return "identity", 0.0

    cat_embeds = _get_category_embeddings()

    if embedding is not None:
        text_vec = np.array(embedding, dtype=np.float32)
    else:
        model = _get_model()
        text_vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)

    # Normalize
    norm = np.linalg.norm(text_vec)
    if norm > 0:
        text_vec = text_vec / norm

    best_category = "identity"
    best_score = -1.0

    for category, centroid in cat_embeds.items():
        centroid_norm = np.linalg.norm(centroid)
        if centroid_norm > 0:
            sim = float(np.dot(text_vec, centroid / centroid_norm))
        else:
            sim = 0.0
        if sim > best_score:
            best_score = sim
            best_category = category

    return best_category, round(max(0.0, best_score), 4)


def classify_nim_fallback(text: str, api_key: str, base_url: str, model_name: str) -> Optional[Tuple[str, float]]:
    """NIM LLM fallback for low-confidence classifications.

    Per §2.0 guardrail: if NIM is unreachable, returns None and the local
    result is used. Trigger tagging NEVER fails or blocks a check-in
    because the NIM free tier is rate-limited.
    """
    categories_str = ", ".join(TRIGGER_CATEGORIES.keys())
    prompt = (
        f"Classify the following journal entry into exactly ONE of these stress trigger categories: "
        f"{categories_str}.\n\n"
        f"Journal entry: \"{text}\"\n\n"
        f"Respond with ONLY the category name, nothing else."
    )

    try:
        resp = requests.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a clinical psychology taxonomy classifier. Respond with only the category name."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
                "max_tokens": 30,
            },
            timeout=8,
        )
        if resp.status_code == 200:
            data = resp.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
                .lower()
                .replace(" ", "_")
            )
            # Validate returned category
            if content in TRIGGER_CATEGORIES:
                return content, 0.85
            # Try partial match
            for cat in TRIGGER_CATEGORIES:
                if cat in content:
                    return cat, 0.80
        else:
            logger.warning("NIM fallback returned HTTP %d: %s", resp.status_code, resp.text[:200])
    except requests.exceptions.Timeout:
        logger.warning("NIM fallback timed out (8s). Using local classification.")
    except Exception as e:
        logger.warning("NIM fallback error: %s. Using local classification.", e)

    return None


def classify_trigger(
    text: str,
    embedding: Optional[List[float]] = None,
    nim_api_key: str = "",
    nim_base_url: str = "https://integrate.api.nvidia.com/v1",
    nim_model: str = "deepseek-ai/deepseek-v4-pro-0813",
) -> Dict[str, Any]:
    """Full classification pipeline: local first, NIM fallback on low confidence.

    Returns dict with keys: category, confidence, source ('embedding' or 'nim').
    NEVER raises — always returns a valid classification.
    """
    t0 = time.time()

    # Layer 1: Local embedding classifier (always runs, always succeeds)
    local_category, local_confidence = classify_local(text, embedding)

    # If confidence is above threshold, use local result
    if local_confidence >= CONFIDENCE_THRESHOLD or not nim_api_key:
        return {
            "category": local_category,
            "confidence": local_confidence,
            "source": "embedding",
            "latency_ms": round((time.time() - t0) * 1000, 2),
        }

    # Layer 2: NIM fallback (only on low confidence, fail-safe)
    nim_result = classify_nim_fallback(text, nim_api_key, nim_base_url, nim_model)
    if nim_result:
        category, confidence = nim_result
        return {
            "category": category,
            "confidence": confidence,
            "source": "nim",
            "latency_ms": round((time.time() - t0) * 1000, 2),
        }

    # NIM failed — use local result anyway (guardrail: never block)
    return {
        "category": local_category,
        "confidence": local_confidence,
        "source": "embedding",
        "latency_ms": round((time.time() - t0) * 1000, 2),
    }
