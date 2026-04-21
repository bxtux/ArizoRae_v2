from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Service auth
    AGENT_WORKER_SECRET: str

    # Anthropic
    ANTHROPIC_API_KEY_ADMIN: str
    DEFAULT_USER_QUOTA_TOKENS: int = 500_000

    # DB
    DATABASE_URL: str

    # Paths
    USERS_DATAS_DIR: str = "/users_datas"
    SKILL_DIR: str = "/skills/rae-generic"

    # Crypto (re-use AUTH_SECRET_KEY for user key encryption)
    AUTH_SECRET_KEY: str

    # Misc
    LOG_LEVEL: str = "info"


settings = Settings()
