"""Dominio de Cotización y Rating.

Responsabilidad: Reglas actuariales, prima en tiempo real.
Entidades propias: Cotizacion.
Persistencia: BD cotizacion.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
