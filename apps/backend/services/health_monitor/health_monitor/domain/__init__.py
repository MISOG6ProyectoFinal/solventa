"""Dominio de Monitor de Salud y Retiro.

Responsabilidad: Verifica endpoints y retira instancias caídas.
Entidades propias: ninguna (no es dueño de un almacén).
Persistencia: sin almacén propio.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en main.py.
"""
