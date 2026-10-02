"""Canales. Backends por experiencia: web, móvil y API pública de socios.

Persistencia: sin almacén propio. Cada módulo corresponde a un componente del modelo VC-003
v2.0 y mantiene su propio dominio; solo comparten el despliegue y la base.

- web: BFF Web
- movil: BFF Móvil
- socios: API Pública de Socios
"""
