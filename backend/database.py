import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 로컬 개발: DATABASE_URL 없으면 sqlite로 자동 폴백.
# 배포/Supabase 연동 시: .env에 Supabase의 "Connection string" (postgresql+psycopg2://...) 넣기.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./zone.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
