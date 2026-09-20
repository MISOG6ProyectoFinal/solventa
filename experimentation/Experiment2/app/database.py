import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# URL de conexión a la base de datos PostgreSQL (vendrá de Docker Compose)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://usuario:password@db:5432/solventa_siniestros")

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db():
    # Crea las tablas si no existen
    Base.metadata.create_all(bind=engine)
