from collections.abc import Generator
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker


env_file = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_file)

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise RuntimeError(f"DATABASE_URL was not found in {env_file}")

engine = create_engine(database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    with engine.connect() as connection:
        database_name, user_name = connection.execute(
            text("SELECT current_database(), current_user")
        ).one()

    print(f"Connected to database: {database_name}")
    print(f"Connected as user: {user_name}")