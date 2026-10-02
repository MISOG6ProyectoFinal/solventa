"""Dominio de Siniestros.

Responsabilidad: Aviso, evidencia, evaluación, peritaje.
Entidades propias: Siniestro, Evidencia, Perito, Prestador.
Persistencia: BD siniestros.
Publica en el bus: siniestro.reportado.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
