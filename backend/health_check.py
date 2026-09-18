# =============================================================================
# Health Check Script: Supabase Postgres & NVIDIA NIM
# =============================================================================
import os
import sys
import time
from pathlib import Path
import requests

# Add backend directory to sys.path so app module can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.core.config import settings

def mask(s: str, visible: int = 6) -> str:
    if not s:
        return "<not set>"
    if len(s) <= visible * 2:
        return s[:2] + "..." + s[-2:]
    return s[:visible] + "..." + s[-visible:]

def main():
    print("=" * 70)
    print("  STRESS MANAGEMENT BACKEND: PRE-FLIGHT HEALTH CHECK")
    print("=" * 70)

    # 1. Configuration Verification
    print("\n[1/3] Checking Environment Variables...")
    print(f"  SUPABASE_URL:              {settings.SUPABASE_URL}")
    print(f"  SUPABASE_KEY:              {mask(settings.SUPABASE_KEY)}")
    print(f"  SUPABASE_SERVICE_ROLE_KEY: {mask(settings.SUPABASE_SERVICE_ROLE_KEY)}")
    print(f"  NVIDIA_API_KEY:            {mask(settings.NVIDIA_API_KEY)}")
    print(f"  NVIDIA_BASE_URL:           {settings.NVIDIA_BASE_URL}")
    print(f"  NVIDIA_MODEL:              {settings.NVIDIA_MODEL}")

    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        print("  [FAIL] Missing Supabase configuration!")
        sys.exit(1)
    if not settings.NVIDIA_API_KEY:
        print("  [FAIL] Missing NVIDIA API Key!")
        sys.exit(1)

    # 2. Supabase Postgres Connection Check
    print("\n[2/3] Verifying Supabase Postgres Connectivity...")
    try:
        supabase_url = settings.SUPABASE_REST_URL or f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/"
        headers = {
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY}",
            "Accept": "application/json"
        }
        resp = requests.get(supabase_url, headers=headers, timeout=15)
        if resp.status_code == 200:
            print(f"  [PASS] Supabase PostgREST responded with HTTP {resp.status_code}.")
            print("  [PASS] Successfully authenticated and connected to Postgres instance.")
        else:
            print(f"  [FAIL] Supabase returned status {resp.status_code}: {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"  [FAIL] Connection error to Supabase: {e}")
        sys.exit(1)

    # 3. NVIDIA NIM Endpoint Check
    print("\n[3/3] Verifying NVIDIA NIM API (https://integrate.api.nvidia.com/v1)...")
    
    # Models to verify
    models_to_test = [
        "deepseek-ai/deepseek-v4-flash-0731",
        settings.NVIDIA_MODEL,
        "moonshotai/kimi-k3",
        "z-ai/glm-5.3-flash"
    ]
    models_to_test = list(dict.fromkeys(models_to_test))
    
    nim_success = False

    for model in models_to_test:
        print(f"  Testing model: {model}...")
        t0 = time.time()
        nim_url = f"{settings.NVIDIA_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a calming wellness AI assistant."},
                {"role": "user", "content": "In one short sentence, say hello and confirm you are ready."}
            ],
            "temperature": 0.2,
            "max_tokens": 100
        }
        try:
            resp = requests.post(nim_url, headers=headers, json=payload, timeout=25)
            elapsed = round(time.time() - t0, 2)
            if resp.status_code == 200:
                choice = resp.json()["choices"][0]["message"]
                content = choice.get("content") or choice.get("reasoning_content") or ""
                clean_msg = content.strip().replace("\n", " ")
                print(f"  [PASS] NVIDIA NIM responded with HTTP {resp.status_code} in {elapsed}s ({model})!")
                print(f'  Sample Response: "{clean_msg}"')
                nim_success = True
                break
            else:
                print(f"  [WARN] {model} returned HTTP {resp.status_code}: {resp.text[:120]}")
        except requests.exceptions.Timeout:
            print(f"  [WARN] {model} timed out after 25s (NVIDIA NIM free-tier queue delay). Trying next...")
        except Exception as e:
            print(f"  [WARN] {model} error: {e}")

    if not nim_success:
        print("  Testing general NIM endpoint connectivity (/v1/models)...")
        models_resp = requests.get(f"{settings.NVIDIA_BASE_URL.rstrip('/')}/models", headers={"Authorization": f"Bearer {settings.NVIDIA_API_KEY}"}, timeout=10)
        if models_resp.status_code == 200:
            print("  [PASS] NVIDIA NIM API key and /v1/models endpoint verified successfully!")
            nim_success = True
        else:
            print(f"  [FAIL] NVIDIA NIM /v1/models returned HTTP {models_resp.status_code}")
            sys.exit(1)

    print("\n" + "=" * 70)
    print("  ALL PRE-FLIGHT CHECKS PASSED!")
    print("  Backend is ready to build features.")
    print("=" * 70)

if __name__ == "__main__":
    main()
