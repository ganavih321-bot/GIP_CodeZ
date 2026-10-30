from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "GIP_CodeZ"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "gip_codez_super_secret_jwt_key_2026_dev"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # PostgreSQL connection (psycopg 3 driver)
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/gip_codez"

    # Google Sign-In: OAuth 2.0 Web Client ID from Google Cloud Console
    GOOGLE_CLIENT_ID: str = ""
    # Comma-separated emails that are always granted the admin role on Google login
    ADMIN_EMAILS: str = ""

    # Execution Sandbox settings
    CODE_TIMEOUT_SECONDS: int = 5
    MAX_MEMORY_MB: int = 128
    DOCKER_IMAGE: str = "python:3.12-slim"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()}

settings = Settings()
