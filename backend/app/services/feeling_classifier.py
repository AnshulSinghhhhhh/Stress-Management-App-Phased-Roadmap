"""Feeling classifier from check-in text (v2.2 Objective 2).

Scope: TEXT ONLY (transcribed voice + typed free text).
- Reuses the existing local-first pattern: sentence-transformers/all-MiniLM-L6-v2
  calculates cosine similarity against few-shot exemplars for the 8 canonical
  EmotionalTags defined in EmotionalTags.tsx:
  Calm, Grateful, Focused, Hopeful, Tired, Restless, Anxious, Overwhelmed.
- NIM fallback on low confidence (fail-safe: never raises, never blocks check-in).
- Zero effect on calibrated stress score formula.
- Only runs if text is provided.
"""
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import requests

logger = logging.getLogger(__name__)

# The canonical 8 emotional tags from frontend/src/components/EmotionalTags.tsx
EMOTION_VOCABULARY: List[str] = [
    "Calm",
    "Grateful",
    "Focused",
    "Hopeful",
    "Tired",
    "Restless",
    "Anxious",
    "Overwhelmed",
]

# Few-shot representative exemplars for each of the 8 canonical emotions
EMOTION_EXEMPLARS: Dict[str, List[str]] = {
    "Calm": [
        "Feeling peaceful, still, and centered today.",
        "A quiet morning by the window with deep slow breathing.",
        "My mind feels steady, clear, and relaxed.",
        "No rush, just sitting in quiet contentment.",
        "Grounded and completely at ease with my thoughts.",
    ],
    "Grateful": [
        "So thankful for the kindness of my loved ones and friends.",
        "Appreciating the small quiet moments in my day.",
        "Full of gratitude for good health and steady support.",
        "Feeling blessed and appreciative for how things turned out.",
        "Remembering all the good things I have right now.",
    ],
    "Focused": [
        "In the zone and making solid uninterrupted progress on my goals.",
        "Clear-headed, attentive, and fully engaged with what I am doing.",
        "Dialed in and concentrating with clear mental clarity.",
        "Productive rhythm today, zero distractions pulling me away.",
        "Steady mental focus on the priorities that matter.",
    ],
    "Hopeful": [
        "Looking forward to tomorrow with optimistic expectation.",
        "Things are starting to turn around and looking brighter.",
        "Encouraged by recent progress, feeling like things will work out.",
        "A warm sense of optimism about what lies ahead.",
        "Positive energy and renewed hope for the future.",
    ],
    "Tired": [
        "Completely exhausted, drained, and struggling to keep my eyes open.",
        "Low physical energy, my body feels heavy and fatigued.",
        "Didn't sleep well and feeling sluggish and worn out all day.",
        "Depleted stamina, desperately need some quiet sleep and rest.",
        "Mental and physical exhaustion catching up with me.",
    ],
    "Restless": [
        "Fidgety, unable to settle down or sit still in one place.",
        "My mind keeps buzzing and jumping between thoughts erratically.",
        "Agitated and impatient, feeling like I need to be doing something.",
        "Internal tension making it hard to relax or unwind.",
        "Pacing around with unsettled and scattered nervous energy.",
    ],
    "Anxious": [
        "Heart pounding, nervous dread about what might happen next.",
        "Constant racing worries and catastrophizing about the future.",
        "A tight knot in my chest and nervous dread that won't go away.",
        "Terrified of making mistakes and feeling uneasy all morning.",
        "On edge, hypervigilant, and worrying constantly about everything.",
    ],
    "Overwhelmed": [
        "Too many demands hitting me at once, drowning under pressure.",
        "Paralyzed by workload, deadlines, and emotional burdens.",
        "Everything is crashing down and I don't know where to start.",
        "Total sensory and emotional overload, completely burnt out.",
        "At my absolute limit, can't handle any more tasks or stress.",
    ],
}

# Centroid cache
_emotion_centroids: Optional[Dict[str, np.ndarray]] = None

def _get_model():
    """Import and get lazy-loaded embedding model from trigger_classifier."""
    from app.services.trigger_classifier import _get_model as _get_trigger_model
    return _get_trigger_model()

def _get_emotion_centroids() -> Dict[str, np.ndarray]:
    """Compute and cache normalized centroids for each of the 8 emotions."""
    global _emotion_centroids
    if _emotion_centroids is not None:
        return _emotion_centroids

    model = _get_model()
    _emotion_centroids = {}
    for emotion, examples in EMOTION_EXEMPLARS.items():
        vecs = model.encode(examples, convert_to_numpy=True, normalize_embeddings=True)
        mean_vec = np.mean(vecs, axis=0)
        norm = np.linalg.norm(mean_vec)
        if norm > 0:
            mean_vec = mean_vec / norm
        _emotion_centroids[emotion] = mean_vec
    return _emotion_centroids


CONFIDENCE_THRESHOLD = 0.32


def classify_feelings_local(
    text: str,
    embedding: Optional[List[float]] = None,
    top_k: int = 2,
) -> Tuple[List[str], float]:
    """Classify text against the 8 canonical emotions using local embeddings.

    Returns (top_feelings, top_confidence) where confidence is highest cosine similarity.
    """
    if not text or not text.strip():
        return [], 0.0

    centroids = _get_emotion_centroids()

    if embedding is not None and len(embedding) == 384:
        text_vec = np.array(embedding, dtype=np.float32)
    else:
        model = _get_model()
        text_vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)

    norm = np.linalg.norm(text_vec)
    if norm > 0:
        text_vec = text_vec / norm

    scored: List[Tuple[str, float]] = []
    for emotion, centroid in centroids.items():
        centroid_norm = np.linalg.norm(centroid)
        if centroid_norm > 0:
            sim = float(np.dot(text_vec, centroid / centroid_norm))
        else:
            sim = 0.0
        scored.append((emotion, sim))

    scored.sort(key=lambda x: x[1], reverse=True)
    top_confidence = round(max(0.0, scored[0][1]), 4)

    # Return top feelings that pass threshold or top 1
    selected = [scored[0][0]]
    if len(scored) > 1 and scored[1][1] >= (scored[0][1] - 0.08) and scored[1][1] >= 0.28:
        selected.append(scored[1][0])

    return selected[:top_k], top_confidence


def classify_feelings_nim_fallback(
    text: str,
    api_key: str,
    base_url: str,
    model_name: str,
) -> Optional[Tuple[List[str], float]]:
    """NIM fallback for feeling detection when local confidence is marginal."""
    vocab_str = ", ".join(EMOTION_VOCABULARY)
    prompt = (
        f"Identify 1 or 2 emotions from this list that best describe the tone of the journal entry: "
        f"{vocab_str}.\n\n"
        f"Journal entry: \"{text}\"\n\n"
        f"Respond ONLY with comma-separated emotion names from the list above, nothing else."
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
                    {"role": "system", "content": "You are a clinical emotional tone classifier. Respond strictly with emotion names from the requested vocabulary."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
                "max_tokens": 20,
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
            )
            found: List[str] = []
            for emotion in EMOTION_VOCABULARY:
                if emotion.lower() in content.lower():
                    found.append(emotion)
            if found:
                return found[:2], 0.85
    except Exception as e:
        logger.warning("NIM feeling classification fallback skipped: %s", e)

    return None


def classify_feelings(
    text: Optional[str],
    embedding: Optional[List[float]] = None,
    nim_api_key: str = "",
    nim_base_url: str = "https://integrate.api.nvidia.com/v1",
    nim_model: str = "deepseek-ai/deepseek-v4-pro-0813",
) -> Dict[str, Any]:
    """Classify free text into 1-2 suggested feelings from the 8-tag vocabulary.

    Returns dict:
      detected_feelings: List[str]
      confidence: Optional[float]
      source: 'embedding' | 'nim' | None
    """
    if not text or not text.strip():
        return {
            "detected_feelings": [],
            "confidence": None,
            "source": None,
        }

    t0 = time.time()
    feelings, conf = classify_feelings_local(text, embedding=embedding)

    if conf >= CONFIDENCE_THRESHOLD or not nim_api_key:
        return {
            "detected_feelings": feelings,
            "confidence": conf,
            "source": "embedding",
            "latency_ms": round((time.time() - t0) * 1000, 2),
        }

    # NIM fallback
    nim_res = classify_feelings_nim_fallback(text, nim_api_key, nim_base_url, nim_model)
    if nim_res:
        f_list, nim_conf = nim_res
        return {
            "detected_feelings": f_list,
            "confidence": nim_conf,
            "source": "nim",
            "latency_ms": round((time.time() - t0) * 1000, 2),
        }

    return {
        "detected_feelings": feelings,
        "confidence": conf,
        "source": "embedding",
        "latency_ms": round((time.time() - t0) * 1000, 2),
    }
