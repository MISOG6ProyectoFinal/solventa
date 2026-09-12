from sqlalchemy import Column, String, DateTime, JSON, Boolean
from datetime import datetime
from database import Base

class RegistroIdempotencia(Base):
    """
    Tabla para garantizar que un evento procesado no vuelva a generar 
    pagos/liquidaciones duplicadas si Amazon SQS lo re-entrega por error.
    """
    __tablename__ = "registro_idempotencia"
    
    idempotency_key = Column(String, primary_key=True, index=True)
    fecha_procesamiento = Column(DateTime, default=datetime.utcnow)
    exitoso = Column(Boolean, default=True)

class SiniestroLiquidado(Base):
    """
    Simulación del estado de negocio. El siniestro paramétrico aprobado.
    """
    __tablename__ = "siniestros_liquidados"

    id = Column(String, primary_key=True, index=True)
    poliza_id = Column(String, index=True)
    evento_tipo = Column(String)
    datos_evento = Column(JSON)
    fecha_liquidacion = Column(DateTime, default=datetime.utcnow)
