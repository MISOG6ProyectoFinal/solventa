"""Dominio de Identidad, Consentimiento y KYC.

Responsabilidad: Onboarding, MFA, biometría, revocación.
Entidades propias: Cliente, Consentimiento, Usuario.
Persistencia: BD identidad.

El dominio no importa FastAPI, SQLAlchemy ni boto3: los puertos (ports.py) se
implementan en adapters/ y se ensamblan en entrypoints/.
"""
