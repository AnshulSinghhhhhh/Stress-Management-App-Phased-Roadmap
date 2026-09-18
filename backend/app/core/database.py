"""Database connection and session factory.
Supports Supabase PostgreSQL as well as local SQLite fallback for isolated unit testing.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# If DATABASE_URL is set, use it; otherwise fallback to local SQLite for zero-setup local dev/test
database_url = settings.DATABASE_URL
if not database_url:
    database_url = "sqlite:///./stress_management.db"

# Handle sqlite specific connection args
connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
