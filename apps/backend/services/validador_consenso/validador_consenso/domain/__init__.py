"""Dominio de Validador de Consenso.

Responsabilidad: Compara resultados de Cotización (2 de 3, acotado en tiempo).
Entidades propias: ninguna (no es dueño de un almacén).
Persistencia: sin almacén propio.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
