"""Pytest fixtures for Phase 1 backend test suite."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.models import User
from app.main import app

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    return engine

@pytest.fixture
def db_session(test_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    # Ensure default demo user exists
    demo = session.query(User).filter(User.id == "demo_user").first()
    if not demo:
        demo = User(
            id="demo_user",
            email="demo@example.com",
            locale="en",
            consent_version_accepted="1.0.0",
            data_retention_pref="standard"
        )
        session.add(demo)
        session.commit()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(test_engine, db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
