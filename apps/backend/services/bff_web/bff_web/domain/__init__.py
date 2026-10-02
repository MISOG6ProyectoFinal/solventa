"""Dominio de BFF Web.

Responsabilidad: Composición para gestión y back-office.
Entidades propias: ninguna (no es dueño de un almacén).
Persistencia: sin almacén propio.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
