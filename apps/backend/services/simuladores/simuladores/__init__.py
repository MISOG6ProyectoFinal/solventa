"""Simuladores de terceros. Solventa los llama por HTTP como a un proveedor real.

- open_finance: perfil financiero con score de riesgo (Cotización, HU018).
- pasarela: cobros con clave de idempotencia (Pagos).
- notificaciones: SMS y correo, como el OTP del consentimiento (Identidad).
- red_asistencia: despacho de grúa, ambulancia y perito (Siniestros).

Cada uno tiene un modo (normal, lento, caido, invalida) que se cambia en /simuladores.
"""
