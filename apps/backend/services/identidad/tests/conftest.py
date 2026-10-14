import os

# Unit tests do not read the local .env. The value is only a fixture.
os.environ.setdefault("SESION_SECRETO", "test-sesion-secreto")
