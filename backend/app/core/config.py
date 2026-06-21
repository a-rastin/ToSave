from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database: defaults to local sqlite so the app runs with zero config.
    database_url: str = "sqlite+aiosqlite:///./gord.db"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    algorithm: str = "HS256"

    allow_signup: bool = True
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
