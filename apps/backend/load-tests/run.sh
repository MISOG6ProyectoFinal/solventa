#!/usr/bin/env bash
# Prueba de carga de Canales con Newman: cada usuario virtual es una corrida de la colección en paralelo.
#   USUARIOS=10 ITERACIONES=20 ./load-tests/run.sh
# Variables:
#   BASE_URL        URL pública (por defecto la de la colección)
#   USUARIOS        usuarios virtuales en paralelo (5)
#   ITERACIONES     recorridos por usuario (10)
#   RAMPA_S         segundos para arrancar a todos los usuarios (0)
#   PAUSA_MS        pausa entre peticiones de un mismo usuario (0)
#   UMBRAL_P95_MS   p95 máximo aceptado en general (1000)
#   UMBRAL_COTIZACION_MS  p95 máximo de las cotizaciones, ASR-01 (400)
#   UMBRAL_ERRORES  porcentaje máximo de errores (1)
#   SALIDA          carpeta de resultados (load-tests/resultados/<fecha>)
#   SOCIO_ID, SOCIO_CLIENT_ID, SOCIO_SECRETO  socio existente; si faltan, se crea uno con el ramo de viaje
set -euo pipefail
cd "$(dirname "$0")/.."  # apps/backend

COLECCION=postman/carga-canales.postman_collection.json
NEWMAN=(npx --yes newman@6.2.1)
USUARIOS="${USUARIOS:-5}"
ITERACIONES="${ITERACIONES:-10}"
RAMPA_S="${RAMPA_S:-0}"
PAUSA_MS="${PAUSA_MS:-0}"
SALIDA="${SALIDA:-load-tests/resultados/$(date +%Y%m%d-%H%M%S)}"

BASE_URL="${BASE_URL:-$(node -e "const c = require('./$COLECCION'); console.log(c.variable.find((v) => v.key === 'baseUrl').value)")}"
BASE_URL="${BASE_URL%/}"

if [[ -z "${SOCIO_ID:-}" || -z "${SOCIO_CLIENT_ID:-}" || -z "${SOCIO_SECRETO:-}" ]]; then
  read -r SOCIO_ID SOCIO_CLIENT_ID SOCIO_SECRETO < <(node load-tests/socio.mjs "$BASE_URL" || true)
  if [[ -z "${SOCIO_SECRETO:-}" ]]; then
    echo "No se pudo crear el socio de la prueba en $BASE_URL" >&2
    exit 1
  fi
  echo "==> Socio de la prueba: $SOCIO_ID"
fi

opciones=(-n "$ITERACIONES" --reporters json
  --env-var "baseUrl=$BASE_URL"
  --env-var "socioId=$SOCIO_ID"
  --env-var "socioClientId=$SOCIO_CLIENT_ID"
  --env-var "socioSecreto=$SOCIO_SECRETO")
if ((PAUSA_MS > 0)); then
  opciones+=(--delay-request "$PAUSA_MS")
fi

mkdir -p "$SALIDA"
"${NEWMAN[@]}" --version >/dev/null

echo "==> $USUARIOS usuarios x $ITERACIONES iteraciones -> $SALIDA"
pids=()
for i in $(seq 1 "$USUARIOS"); do
  "${NEWMAN[@]}" run "$COLECCION" "${opciones[@]}" --reporter-json-export "$SALIDA/usuario-$i.json" \
    >"$SALIDA/usuario-$i.log" 2>&1 &
  pids+=("$!")
  if ((RAMPA_S > 0 && i < USUARIOS)); then
    sleep "$(awk "BEGIN { print $RAMPA_S / ($USUARIOS - 1) }")"
  fi
done

for pid in "${pids[@]}"; do
  wait "$pid" || true
done

node load-tests/report.mjs "$SALIDA" \
  --umbral-p95 "${UMBRAL_P95_MS:-1000}" \
  --umbral-errores "${UMBRAL_ERRORES:-1}" \
  --umbral-cotizacion "${UMBRAL_COTIZACION_MS:-400}" \
  --usuarios "$USUARIOS"
