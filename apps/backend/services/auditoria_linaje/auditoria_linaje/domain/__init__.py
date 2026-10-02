"""Dominio de Auditoría y Linaje del Dato.

Responsabilidad: Trazabilidad reconstruible al 100%.
Entidades propias: RegistroAuditoria.
Persistencia: BD auditoria.
Se suscribe a: todos los eventos de integración.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
