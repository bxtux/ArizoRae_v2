from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # DB
    DATABASE_URL: str

    # Services
    AGENT_WORKER_URL: str = "http://agent:8000"
    AGENT_WORKER_SECRET: str

    # SMTP (pour mails digest)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_FROM_NAME: str = "ArizoRAE"

    # Paths
    USERS_DATAS_DIR: str = "/users_datas"

    # Sandbox limits
    SCRAPER_TIMEOUT_SECONDS: int = 300
    SCRAPER_MEMORY_MB: int = 512

    LOG_LEVEL: str = "info"


settings = Settings()
