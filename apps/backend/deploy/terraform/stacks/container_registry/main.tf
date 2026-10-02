# Un repositorio por imagen. Las imágenes se construyen y publican con
# apps/backend/scripts/build-images.sh (REGISTRY = output registry).
module "ecr" {
  source = "../../modules/ecr"

  repositories = var.services
  force_delete = var.force_delete
}
