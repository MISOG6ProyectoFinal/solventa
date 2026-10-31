#!/usr/bin/env bash
# Prueba de carga de Canales con k6 (load-tests/canales.js).
#   PERFIL=humo  ./load-tests/run.sh                      # una iteración por canal
#   PERFIL=carga DURACION=5m ./load-tests/run.sh          # recorridos móvil y web + cotización de socios a tasa fija
#   PERFIL=asr04 TASA_OBJETIVO=50000 ./load-tests/run.sh  # rampa de cotizaciones de socios (ASR-04 y ASR-05)
#   PERFIL=degradacion ./load-tests/run.sh                # Open Finance normal, caído y recuperado (HU018)
# Usa k6 instalado o, si no está, la imagen grafana/k6. Las variables del README se pasan tal cual a k6.
set -euo pipefail
cd "$(dirname "$0")"  # apps/backend/load-tests

K6_IMAGEN=grafana/k6:2.3.0
VARIABLES=(BASE_URL PERFIL DURACION USUARIOS_MOVIL USUARIOS_WEB TASA_SOCIOS VUS_SOCIOS TASA_VENTAS VUS_VENTAS TASA_INICIAL TASA_OBJETIVO
  RAMPA SOSTENIDO VUS_INICIALES VUS_MAXIMOS UMBRAL_P95_MS UMBRAL_COTIZACION_MS UMBRAL_ERRORES UMBRAL_DISPONIBILIDAD
  SOCIO_ID SOCIO_CLIENT_ID SOCIO_SECRETO OPEN_FINANCE_SIMULADO_URL SEGUNDOS_POR_FASE MODO_CAIDA CLIENTES_OPEN_FINANCE)

export PERFIL="${PERFIL:-carga}"
export SALIDA="${SALIDA:-resultados/$(date +%Y%m%d-%H%M%S)-$PERFIL}"
mkdir -p "$SALIDA"

argumentos=()
for variable in "${VARIABLES[@]}" SALIDA; do
  if [[ -n "${!variable:-}" ]]; then
    argumentos+=(-e "$variable=${!variable}")
  fi
done

export K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=-1 K6_WEB_DASHBOARD_PERIOD="${K6_WEB_DASHBOARD_PERIOD:-5s}" K6_WEB_DASHBOARD_EXPORT="$SALIDA/dashboard.html"

if command -v k6 >/dev/null; then
  k6 run "${argumentos[@]}" canales.js
else
  docker run --rm -i -u "$(id -u):$(id -g)" -v "$PWD:/pruebas" -w /pruebas --add-host=host.docker.internal:host-gateway \
    -e K6_WEB_DASHBOARD -e K6_WEB_DASHBOARD_PORT -e K6_WEB_DASHBOARD_PERIOD -e K6_WEB_DASHBOARD_EXPORT \
    "$K6_IMAGEN" run "${argumentos[@]}" canales.js
fi
