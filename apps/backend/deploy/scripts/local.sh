#!/usr/bin/env bash
# Modo local: k3s en Docker con los mismos manifiestos de AWS, Postgres en el clúster y LocalStack.
#   deploy/scripts/local.sh up        # construye las imágenes, levanta k3s y despliega
#   deploy/scripts/local.sh status
#   deploy/scripts/local.sh logs <servicio>
#   deploy/scripts/local.sh down      # borra el clúster y sus datos
# API en http://localhost:8000 (la que usa el portal con npm run start:local); LocalStack en http://localhost:4566.
set -euo pipefail
cd "$(dirname "$0")/../.."  # apps/backend

K3S_IMAGEN=rancher/k3s:v1.35.9-k3s1
CONTENEDOR=solventa-k3s
NAMESPACE=solventa
TAG=local

kubectl_k3s() {
  docker exec -i "$CONTENEDOR" kubectl "$@"
}

levantar_k3s() {
  if [[ -z "$(docker ps -q -f "name=^${CONTENEDOR}$")" ]]; then
    docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
    echo "==> k3s ($K3S_IMAGEN)"
    docker run -d --name "$CONTENEDOR" --privileged \
      -p 8000:80 -p 4566:30566 \
      -v "$CONTENEDOR:/var/lib/rancher/k3s" \
      -v "$PWD/deploy/k8s:/solventa/k8s:ro" \
      "$K3S_IMAGEN" server --node-name solventa >/dev/null
  fi
  until kubectl_k3s get --raw /readyz >/dev/null 2>&1; do sleep 2; done
  until kubectl_k3s get serviceaccount default >/dev/null 2>&1; do sleep 2; done
}

importar_imagenes() {
  echo "==> Imágenes solventa/<servicio>:$TAG"
  TAG="$TAG" ./scripts/build-images.sh
  local imagenes=()
  for dir in services/*/; do
    nombre="$(basename "$dir")"
    imagenes+=("solventa/${nombre//_/-}:$TAG")
  done
  docker save "${imagenes[@]}" | docker exec -i "$CONTENEDOR" ctr images import - >/dev/null
}

secreto_de_sesion() {
  kubectl_k3s create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl_k3s apply -f - >/dev/null
  if ! kubectl_k3s -n "$NAMESPACE" get secret sesion >/dev/null 2>&1; then
    kubectl_k3s -n "$NAMESPACE" create secret generic sesion \
      --from-literal=SESION_SECRETO="$(openssl rand -hex 32)" >/dev/null
  fi
}

desplegar() {
  echo "==> Overlay local"
  kubectl_k3s -n "$NAMESPACE" delete job cotizacion-bootstrap siniestros-prestadores-sync --ignore-not-found >/dev/null
  kubectl_k3s apply -k /solventa/k8s/overlays/local >/dev/null
  kubectl_k3s -n "$NAMESPACE" rollout restart deployment -l app.kubernetes.io/part-of=solventa >/dev/null
  kubectl_k3s -n "$NAMESPACE" rollout status statefulset/postgres --timeout=5m
  kubectl_k3s -n "$NAMESPACE" wait --for=condition=complete job/cotizacion-bootstrap --timeout=5m
  kubectl_k3s -n "$NAMESPACE" rollout status deployment -l app.kubernetes.io/part-of=solventa --timeout=10m
}

case "${1:-up}" in
  up)
    levantar_k3s
    importar_imagenes
    secreto_de_sesion
    desplegar
    kubectl_k3s -n "$NAMESPACE" get pods
    echo "Listo: API en http://localhost:8000 (por ejemplo http://localhost:8000/movil/productos)"
    ;;
  status) kubectl_k3s -n "$NAMESPACE" get pods,svc,ingress ;;
  logs) kubectl_k3s -n "$NAMESPACE" logs "deploy/${2:?Falta el servicio}" --tail="${3:-100}" ;;
  down)
    docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
    docker volume rm "$CONTENEDOR" >/dev/null 2>&1 || true
    echo "Clúster local eliminado"
    ;;
  *) echo "Uso: $0 [up|status|logs <servicio>|down]" >&2; exit 1 ;;
esac
