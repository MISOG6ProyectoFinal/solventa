"""Dominio de Analítica, Fraude y Cumplimiento.

Responsabilidad: Modelos de riesgo, reportes regulatorios.
Entidades propias: ninguna (no es dueño de un almacén).
Persistencia: BD auditoria.
Se suscribe a: todos los eventos de integración.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
