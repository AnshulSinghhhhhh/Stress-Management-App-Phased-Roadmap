"""NVIDIA NIM client (OpenAI-compatible) for check-in probing and secondary crisis pass."""
import logging
import requests
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

def generate_chat_completion(
    messages: List[Dict[str, str]],
    api_key: str,
    base_url: str = "https://integrate.api.nvidia.com/v1",
    model: str = "deepseek-ai/deepseek-v4-pro-0813",
    temperature: float = 0.5,
    max_tokens: int = 150,
    timeout: float = 8.0,
) -> Optional[str]:
    """Call NVIDIA NIM API with timeout and fail-open handling.
    Checks both message.content and message.reasoning_content for DeepSeek models.
    Returns generated string or None on failure/timeout.
    """
    if not api_key:
        logger.debug("NVIDIA_API_KEY not configured, skipping NIM call.")
        return None

    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                return None
            msg = choices[0].get("message", {})
            content = msg.get("content") or ""
            # Fallback for DeepSeek models that may return reasoning_content
            if not content.strip() and msg.get("reasoning_content"):
                content = msg.get("reasoning_content")
            return content.strip() if content else None
        else:
            logger.warning("NIM API returned status %d: %s", resp.status_code, resp.text[:200])
            return None
    except requests.exceptions.Timeout:
        logger.warning("NIM API call timed out after %s seconds. Skipping.", timeout)
        return None
    except Exception as e:
        logger.warning("NIM API call failed: %s. Skipping.", e)
        return None
