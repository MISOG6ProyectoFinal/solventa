#!/usr/bin/env bash
# Despliegue completo en AWS, en el orden de dependencias de los stacks.
#   ENV=dev ./deploy/scripts/deploy-aws.sh infra    # Terraform: red → ... → platform
#   ENV=dev ./deploy/scripts/deploy-aws.sh images   # build + push a ECR
#   ENV=dev ./deploy/scripts/deploy-aws.sh k8s      # kustomize overlay aws + kubectl apply
#   ENV=dev ./deploy/scripts/deploy-aws.sh edge     # CloudFront + WAF (opcional)
#   ENV=dev ./deploy/scripts/deploy-aws.sh all
# AUTO_APPROVE=1 omite la confirmación de terraform apply.
set -euo pipefail
cd "$(dirname "$0")/../.."  # apps/backend

ENV="${ENV:-dev}"
TF=deploy/terraform
TAG="${TAG:-$(git rev-parse --short HEAD)}"
INFRA_STACKS=(network container_registry eks data messaging cluster_addons platform)

tf() {
  local stack=$1; shift
  terraform -chdir="$TF/stacks/$stack" "$@"
}

tf_apply() {
  local stack=$1
  echo "==> terraform apply $stack ($ENV)"
  tf "$stack" init -input=false -reconfigure -backend-config="../../environments/$ENV/$stack/backend.tfvars"
  tf "$stack" apply -input=false -var-file="../../environments/$ENV/$stack/terraform.tfvars" \
    ${AUTO_APPROVE:+-auto-approve}
}

registry() {
  tf container_registry output -raw registry
}

infra() {
  for stack in "${INFRA_STACKS[@]}"; do
    tf_apply "$stack"
    if [[ "$stack" == "eks" ]]; then
      aws eks update-kubeconfig --name "$(tf eks output -raw cluster_name)" \
        --region "$(grep -E '^region' "$TF/environments/$ENV/eks/terraform.tfvars" | cut -d'"' -f2)"
    fi
  done
}

images() {
  local host
  host="$(registry)"
  aws ecr get-login-password | docker login --username AWS --password-stdin "$host"
  REGISTRY="$host/solventa" TAG="$TAG" PUSH=1 ./scripts/build-images.sh
}

k8s() {
  local host
  host="$(registry)"
  # Las imágenes del base (solventa/<servicio>:local) pasan a ECR con el tag del commit.
  kubectl kustomize deploy/k8s/overlays/aws \
    | sed -E "s#image: solventa/([a-z0-9-]+)(:local)?\$#image: ${host}/solventa/\1:${TAG}#" \
    | kubectl apply -f -
  kubectl -n solventa wait --for=condition=complete job/cotizacion-bootstrap --timeout=5m
  kubectl -n solventa rollout status deployment --timeout=10m
}

case "${1:-all}" in
  infra) infra ;;
  images) images ;;
  k8s) k8s ;;
  edge) tf_apply edge ;;
  all) infra; images; k8s ;;
  *) echo "Uso: $0 [infra|images|k8s|edge|all]" >&2; exit 1 ;;
esac
