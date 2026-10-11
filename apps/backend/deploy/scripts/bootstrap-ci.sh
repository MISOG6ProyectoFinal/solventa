#!/usr/bin/env bash
# Preparación única del pipeline. La corre una persona con permisos de IAM y de
# administración del repositorio; después todo despliegue pasa por GitHub Actions.
#   1. Bucket S3 de estados de Terraform (versionado, cifrado, privado).
#   2. Stack github_oidc: proveedor OIDC de GitHub y rol de despliegue.
#   3. Environment y variables del repositorio en GitHub.
#   ENV=dev ./deploy/scripts/bootstrap-ci.sh
set -euo pipefail
cd "$(dirname "$0")/../.."  # apps/backend

ENV="${ENV:-dev}"
TF=deploy/terraform
STACK=github_oidc

value() {
  grep -E "^$2[[:space:]]*=" "$TF/environments/$ENV/$STACK/$1" | cut -d'"' -f2
}

BUCKET="$(value backend.tfvars bucket)"
REGION="$(value terraform.tfvars region)"
REPO="$(value terraform.tfvars github_repository)"

echo "==> Bucket de estados: $BUCKET ($REGION)"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "==> Identidad del pipeline (stack $STACK)"
terraform -chdir="$TF/stacks/$STACK" init -input=false -reconfigure \
  -backend-config="../../environments/$ENV/$STACK/backend.tfvars"
terraform -chdir="$TF/stacks/$STACK" apply -input=false \
  -var-file="../../environments/$ENV/$STACK/terraform.tfvars"
ROLE_ARN="$(terraform -chdir="$TF/stacks/$STACK" output -raw deploy_role_arn)"

echo "==> GitHub: environment '$ENV' y variables de $REPO"
# El Environment solo acepta despliegues desde la rama de despliegue y desde los tags
# de release: una rama de trabajo no puede usarlo para asumir el rol de AWS.
BRANCH="$(value terraform.tfvars deploy_branch)"
TAGS="$(value terraform.tfvars release_tag_pattern)"
gh api --method PUT "repos/$REPO/environments/$ENV" \
  -F "deployment_branch_policy[protected_branches]=false" \
  -F "deployment_branch_policy[custom_branch_policies]=true" >/dev/null
gh api --method POST "repos/$REPO/environments/$ENV/deployment-branch-policies" \
  -f "name=$BRANCH" -f "type=branch" >/dev/null 2>&1 || true
gh api --method POST "repos/$REPO/environments/$ENV/deployment-branch-policies" \
  -f "name=$TAGS" -f "type=tag" >/dev/null 2>&1 || true
gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" --body "$ROLE_ARN"
gh variable set AWS_REGION --repo "$REPO" --body "$REGION"

echo
echo "Listo. El pipeline asume $ROLE_ARN"
echo "Siguiente paso: Actions → Backend Infra → Run workflow (plan, luego apply)."
echo "Después, cada release publicado (tag $TAGS) despliega el backend."
