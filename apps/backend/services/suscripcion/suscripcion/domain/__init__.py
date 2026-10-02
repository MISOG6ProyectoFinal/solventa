"""Dominio de Suscripción.

Responsabilidad: Acepta, rechaza o ajusta el riesgo.
Entidades propias: Suscripcion.
Persistencia: BD polizas.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
