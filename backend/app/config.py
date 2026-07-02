from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SARS-CoV-2 Analysis API"
    api_prefix: str = "/api/v1"
    max_upload_files: int = 25
    max_upload_bytes: int = 10_000_000
    max_fasta_records_per_request: int = 250
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "sarscov2"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    use_sqlite_fallback: bool = True
    sqlite_fallback_url: str = "sqlite:///./sarscov2.db"
    reference_accession: str = "NC_045512.2"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url

        if self.use_sqlite_fallback:
            return self.sqlite_fallback_url

        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_mode(self) -> str:
        if self.resolved_database_url.startswith("sqlite"):
            return "sqlite"
        if self.resolved_database_url.startswith("postgresql"):
            return "postgresql"
        return "custom"


settings = Settings()
