"""Application configuration and environment variables.
Reads from environment variables and .env file (never hardcoded).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in current directory, backend root, or project root
current_dir = Path(__file__).resolve().parent
for parent in [current_dir.parent.parent, current_dir.parent.parent.parent]:
    env_file = parent / ".env"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
        break

class Settings:
    PROJECT_NAME: str = "Stress Management App API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Supabase / Postgres Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_REST_URL: str = os.getenv("SUPABASE_REST_URL", "") or (f"{SUPABASE_URL.rstrip('/')}/rest/v1/" if SUPABASE_URL else "")
    SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "") or os.getenv("SUPABASE_KEY", "")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "") or os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWKS_URL: str = os.getenv("SUPABASE_JWKS_URL", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # NVIDIA NIM Configuration
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    NVIDIA_BASE_URL: str = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    NVIDIA_MODEL: str = os.getenv("NVIDIA_MODEL", "deepseek-ai/deepseek-v4-pro-0813")

settings = Settings()

