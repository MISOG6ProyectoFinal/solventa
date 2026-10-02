"""Dominio de Perfilamiento y Personalización.

Responsabilidad: Open Finance, Open Data, explicabilidad.
Entidades propias: PerfilRiesgo, SenalExterna.
Persistencia: BD identidad.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
