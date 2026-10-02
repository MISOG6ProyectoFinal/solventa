"""Dominio de Reaseguro y Cesión.

Responsabilidad: Cartera, siniestralidad, ACORD.
Entidades propias: CesionRiesgo, Reasegurador.
Persistencia: BD polizas.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
