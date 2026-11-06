#!/usr/bin/env bash
# Crea un operador administrador del portal en la base de Identidad del clúster.
#   CONTRASENA=<clave> scripts/crear_administrador.sh <correo> [nombre]
#   EN_IDENTIDAD="docker compose exec -T identidad" scripts/crear_administrador.sh <correo>   # Compose
set -euo pipefail

CORREO="${1:?Uso: $0 <correo> [nombre]}"
NOMBRE="${2:-Administrador}"
read -ra EN_IDENTIDAD <<<"${EN_IDENTIDAD:-kubectl -n solventa exec -i deploy/identidad -c identidad --}"

if [[ -z "${CONTRASENA:-}" ]]; then
  read -rsp "Contraseña de $CORREO: " CONTRASENA
  echo
fi

PROGRAMA=$(cat <<'PY'
import json
import sys

from pydantic import ValidationError
from solventa_common.db import build_engine

from identidad.config import settings
from identidad.operadores.adapters.repository import PostgresOperatorRepository
from identidad.operadores.domain.models import EmailTaken, NewOperator
from identidad.operadores.domain.use_cases import CreateOperator

datos = json.load(sys.stdin)
if not settings.database_url:
    sys.exit("Identidad no tiene base de datos configurada")
operadores = PostgresOperatorRepository(build_engine(settings.database_url))
operadores.create_schema()
try:
    creado = CreateOperator(operadores).execute(NewOperator(roles=["administrador"], **datos))
except EmailTaken:
    print(f"{datos['correo']} ya existe; se deja como está")
except ValidationError as error:
    sys.exit("; ".join(detalle["msg"] for detalle in error.errors()))
else:
    print(f"Administrador {creado.correo} creado")
PY
)

CORREO="$CORREO" NOMBRE="$NOMBRE" CONTRASENA="$CONTRASENA" python3 -c \
  'import json, os; print(json.dumps({"correo": os.environ["CORREO"], "nombre": os.environ["NOMBRE"], "contrasena": os.environ["CONTRASENA"]}))' |
  "${EN_IDENTIDAD[@]}" python -c "$PROGRAMA"
