"""Dominio de Cobros y Pagos.

Responsabilidad: Primas, indemnizaciones, idempotencia.
Entidades propias: Pago.
Persistencia: BD pagos.
Publica en el bus: pago.confirmado.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
