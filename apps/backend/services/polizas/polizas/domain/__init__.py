"""Dominio de Pólizas y Ciclo de Vida.

Responsabilidad: Emisión, endosos, renovación, cancelación.
Entidades propias: Poliza, Endoso, Beneficiario.
Persistencia: BD polizas.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
