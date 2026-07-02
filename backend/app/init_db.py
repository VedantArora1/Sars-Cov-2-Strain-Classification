from app.config import settings
from app.db import Base, engine
from app import models  # noqa: F401


def main():
    Base.metadata.create_all(bind=engine)
    print(f"Database schema initialized using {settings.database_mode}: {settings.resolved_database_url}")


if __name__ == "__main__":
    main()
