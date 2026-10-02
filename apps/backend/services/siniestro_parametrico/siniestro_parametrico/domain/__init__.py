"""Dominio de Siniestro Paramétrico.

Responsabilidad: Disparo automático por evento externo.
Entidades propias: EventoParametrico.
Persistencia: BD siniestros.
Publica en el bus: evento_parametrico.recibido, siniestro_parametrico.liquidado.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
