import os
import pytest

# Point to non-existent dirs so fs helpers don't fail on import
os.environ.setdefault("USERS_DATAS_DIR", "/tmp/test_users_datas")
os.environ.setdefault("SKILL_DIR", "/tmp/test_skills")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-32-chars-minimum!!")
os.environ.setdefault("ANTHROPIC_API_KEY_ADMIN", "sk-ant-test")
os.environ.setdefault("AGENT_WORKER_SECRET", "test-secret")
