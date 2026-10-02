"""Dominio de Catálogo de Productos.

Responsabilidad: Ramos, coberturas, versiones.
Entidades propias: Producto, Cobertura, Ramo.
Persistencia: BD cotizacion.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
