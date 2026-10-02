"""Dominio de Socios y Gobierno de API.

Responsabilidad: Alta, credenciales, alcances, cuotas.
Entidades propias: SocioDistribucion, CredencialApi.
Persistencia: BD cotizacion.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
