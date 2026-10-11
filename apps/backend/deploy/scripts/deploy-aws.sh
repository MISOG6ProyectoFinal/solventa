#!/usr/bin/env bash
# Despliegue en AWS. Lo ejecutan los workflows de GitHub Actions; también corre a mano.
#   deploy-aws.sh plan    [stack]   # terraform plan de un stack o de todos, en orden
#   deploy-aws.sh infra   [stack]   # terraform apply: red → ... → platform → edge
#   deploy-aws.sh destroy [stack]   # terraform destroy, en orden inverso
#   deploy-aws.sh stop              # pausa: nodos en 0 e instancias de RDS detenidas
#   deploy-aws.sh start             # reanuda lo que detuvo stop
#   deploy-aws.sh images            # build + push a ECR y fija el tag en el overlay aws
#   deploy-aws.sh k8s               # aplica el overlay aws con las imágenes ya fijadas + rollout
#   deploy-aws.sh web               # compila el portal con la URL del backend y lo publica en S3 + CloudFront
#   deploy-aws.sh all               # infra + images + k8s + web
# Variables: ENV (dev), TAG (commit, para images), AUTO_APPROVE=1 omite la confirmación de Terraform.
set -euo pipefail
cd "$(dirname "$0")/../.."  # apps/backend

ENV="${ENV:-dev}"
TF=deploy/terraform
TAG="${TAG:-$(git rev-parse --short=12 HEAD)}"
NAMESPACE=solventa
STACKS=(network container_registry eks data messaging cluster_addons platform edge)
WEB=../web/Web.Solventa.Angular

tfvar() {
  grep -E "^$2[[:space:]]*=" "$TF/environments/$ENV/$1/terraform.tfvars" | cut -d'"' -f2
}

REGION="$(tfvar eks region)"
CLUSTER="$(tfvar eks cluster_name)"
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"

tf() {
  local stack=$1; shift
  terraform -chdir="$TF/stacks/$stack" "$@"
}

tf_init() {
  tf "$1" init -input=false -reconfigure -backend-config="../../environments/$ENV/$1/backend.tfvars" >/dev/null
}

var_file() {
  echo "-var-file=../../environments/$ENV/$1/terraform.tfvars"
}

# Stacks a recorrer: el que llega por argumento, o todos.
selected() {
  if [[ -n "${1:-}" && "$1" != "all" ]]; then
    echo "$1"
  else
    printf '%s\n' "${STACKS[@]}"
  fi
}

reversed() {
  if [[ -n "${1:-}" && "$1" != "all" ]]; then
    echo "$1"
    return
  fi
  printf '%s\n' "${STACKS[@]}" | awk '{ lines[NR] = $0 } END { for (i = NR; i > 0; i--) print lines[i] }'
}

plan() {
  local failed=0
  for stack in $(selected "${1:-}"); do
    echo "==> terraform plan $stack ($ENV)"
    # Un stack cuyo antecesor aún no se aplica no puede leer su estado remoto: se reporta y se sigue.
    if ! { tf_init "$stack" && tf "$stack" plan -input=false -lock=false "$(var_file "$stack")"; }; then
      echo "::warning::plan de $stack sin resultado (¿depende de un stack aún sin aplicar?)"
      failed=1
    fi
  done
  [[ -n "${1:-}" && "$1" != "all" ]] && return $failed
  return 0
}

infra() {
  for stack in $(selected "${1:-}"); do
    echo "==> terraform apply $stack ($ENV)"
    tf_init "$stack"
    tf "$stack" apply -input=false "$(var_file "$stack")" ${AUTO_APPROVE:+-auto-approve}
    if [[ "$stack" == "platform" ]]; then
      restart_workloads
    fi
  done
}

restart_workloads() {
  aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION" >/dev/null
  if [[ -n "$(kubectl -n "$NAMESPACE" get deployments -o name 2>/dev/null)" ]]; then
    kubectl -n "$NAMESPACE" rollout restart deployment
  fi
}

destroy() {
  for stack in $(reversed "${1:-}"); do
    tf_init "$stack"
    if [[ -z "$(tf "$stack" state list 2>/dev/null)" ]]; then
      echo "==> $stack sin recursos; se omite"
      continue
    fi
    echo "==> terraform destroy $stack ($ENV)"
    tf "$stack" destroy -input=false "$(var_file "$stack")" ${AUTO_APPROVE:+-auto-approve}
  done
}

PREFIX="$(tfvar network name | cut -d- -f1)"

nodegroups() {
  aws eks list-nodegroups --cluster-name "$CLUSTER" --query 'nodegroups[]' --output text
}

scale_nodegroups() {
  local min=$1 desired=$2 max
  for nodegroup in $(nodegroups); do
    max="$(aws eks describe-nodegroup --cluster-name "$CLUSTER" --nodegroup-name "$nodegroup" \
      --query 'nodegroup.scalingConfig.maxSize' --output text)"
    echo "==> $nodegroup: $desired nodos"
    aws eks update-nodegroup-config --cluster-name "$CLUSTER" --nodegroup-name "$nodegroup" \
      --scaling-config "minSize=$min,maxSize=$max,desiredSize=$desired" >/dev/null
  done
}

databases_in() {
  aws rds describe-db-instances \
    --query "DBInstances[?starts_with(DBInstanceIdentifier, '$PREFIX-') && DBInstanceStatus=='$1'].DBInstanceIdentifier" \
    --output text
}

stop() {
  scale_nodegroups 0 0
  for database in $(databases_in available); do
    echo "==> $database: detener"
    aws rds stop-db-instance --db-instance-identifier "$database" >/dev/null
  done
  echo "Pausado. RDS vuelve a encender una instancia detenida a los 7 días."
}

start() {
  for database in $(databases_in stopped); do
    echo "==> $database: iniciar"
    aws rds start-db-instance --db-instance-identifier "$database" >/dev/null
  done
  for database in $(databases_in starting); do
    aws rds wait db-instance-available --db-instance-identifier "$database"
  done
  local sizes min desired
  sizes="$(grep -E '^nodes_per_zone' "$TF/environments/$ENV/eks/terraform.tfvars")"
  min="$(sed -E 's/.*min *= *([0-9]+).*/\1/' <<<"$sizes")"
  desired="$(sed -E 's/.*desired *= *([0-9]+).*/\1/' <<<"$sizes")"
  scale_nodegroups "$min" "$desired"
  aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION" >/dev/null
  kubectl wait --for=condition=Ready nodes --all --timeout=10m
  kubectl -n "$NAMESPACE" rollout status deployment -l app.kubernetes.io/part-of=solventa --timeout=10m
}

registry_host() {
  echo "${REGISTRY_HOST:-$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${REGION}.amazonaws.com}"
}

images() {
  local host
  host="$(registry_host)"
  aws ecr get-login-password | docker login --username AWS --password-stdin "$host"
  REGISTRY="$host/solventa" TAG="$TAG" PUSH=1 ./scripts/build-images.sh
  ./deploy/scripts/set-image-tag.sh "$host" "$TAG"
}

rollback() {
  echo "::error::El despliegue no quedó sano; se vuelve a la revisión anterior"
  kubectl -n "$NAMESPACE" get pods -o wide || true
  kubectl -n "$NAMESPACE" get events --sort-by=.lastTimestamp | tail -30 || true
  kubectl -n "$NAMESPACE" logs job/cotizacion-bootstrap --tail=20 || true
  for deploy in $(kubectl -n "$NAMESPACE" get deployments -o name); do
    kubectl -n "$NAMESPACE" rollout undo "$deploy" || true
  done
  kubectl -n "$NAMESPACE" rollout status deployment -l app.kubernetes.io/part-of=solventa --timeout=5m || true
}

k8s() {
  local overlay=deploy/k8s/overlays/aws
  # La versión la fija set-image-tag.sh: Backend CD con el tag del release, o 'images' a mano.
  if ! grep -q '^images:' "$overlay/kustomization.yaml"; then
    echo "::error::$overlay no tiene imágenes fijadas. Corre 'images' o Backend CD." >&2
    exit 1
  fi
  aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION" >/dev/null

  # Un Job es inmutable: se recrea para que corra con la imagen de este despliegue.
  kubectl -n "$NAMESPACE" delete job cotizacion-bootstrap --ignore-not-found
  kubectl apply -k "$overlay"

  # Rolling update: cada pod nuevo entra al Service solo cuando pasa su readinessProbe.
  if ! { kubectl -n "$NAMESPACE" wait --for=condition=complete job/cotizacion-bootstrap --timeout=5m \
    && kubectl -n "$NAMESPACE" rollout status deployment -l app.kubernetes.io/part-of=solventa --timeout=10m; }; then
    rollback
    exit 1
  fi
  kubectl -n "$NAMESPACE" get deployments -o wide
}

web() {
  tf_init edge
  if [[ -z "$(tf edge state list 2>/dev/null)" ]]; then
    echo "::notice::El stack edge aún no existe. Corre Backend Infra con apply para publicar el portal."
    return 0
  fi
  local url bucket distribution dist="$WEB/dist/Web.Solventa.Angular/browser"
  url="$(tf edge output -raw url)"
  bucket="$(tf edge output -raw web_bucket)"
  distribution="$(tf edge output -raw distribution_id)"

  (cd "$WEB" && npm ci --no-audit --no-fund && API_BASE_URL="$url" ENVIRONMENT_NAME="$ENV" npm run build:deploy)

  aws s3 sync "$dist" "s3://$bucket" --delete --exclude index.html --exclude "*.json" \
    --cache-control "public,max-age=31536000,immutable"
  aws s3 sync "$dist" "s3://$bucket" --exclude "*" --include index.html --include "*.json" \
    --cache-control "no-cache"
  aws cloudfront create-invalidation --distribution-id "$distribution" --paths "/*" >/dev/null
  echo "Portal publicado en $url"
}

case "${1:-all}" in
  plan) plan "${2:-}" ;;
  infra) infra "${2:-}" ;;
  destroy) destroy "${2:-}" ;;
  stop) stop ;;
  start) start ;;
  images) images ;;
  k8s) k8s ;;
  web) web ;;
  all) infra; images; k8s; web ;;
  *) echo "Uso: $0 [plan|infra|destroy|stop|start|images|k8s|web|all] [stack]" >&2; exit 1 ;;
esac
