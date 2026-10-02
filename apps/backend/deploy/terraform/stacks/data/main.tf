# Persistencia de la Tabla 2: un PostgreSQL por almacén (Database-per-Service),
# la caché de Perfil y Cotización y el almacén de objetos de evidencia.
locals {
  network = data.terraform_remote_state.network.outputs
  # Los pods salen con la IP del nodo (VPC CNI), así que el SG de nodos basta.
  cluster_security_groups = [
    data.terraform_remote_state.eks.outputs.node_security_group_id,
    data.terraform_remote_state.eks.outputs.cluster_security_group_id,
  ]
}

module "postgres" {
  source   = "../../modules/postgres"
  for_each = var.stores

  prefix                     = var.prefix
  name                       = each.key
  vpc_id                     = local.network.vpc_id
  db_subnet_group_name       = local.network.database_subnet_group_name
  subnet_ids                 = local.network.database_subnet_ids
  allowed_security_group_ids = local.cluster_security_groups
  instance_class             = each.value.instance_class
  multi_az                   = each.value.multi_az
  read_replica               = each.value.read_replica
  enable_proxy               = each.value.enable_proxy
  proxy_role_arn             = var.proxy_role_arn
  deletion_protection        = var.deletion_protection
}

module "redis" {
  source = "../../modules/redis"

  name                       = "${var.prefix}-cache"
  vpc_id                     = local.network.vpc_id
  subnet_ids                 = local.network.database_subnet_ids
  allowed_security_group_ids = local.cluster_security_groups
  node_type                  = var.redis_node_type
  node_count                 = var.redis_node_count
}

module "evidencias" {
  source = "../../modules/object_storage"

  bucket_name   = "${var.prefix}-${var.environment}-evidencias-${data.aws_caller_identity.current.account_id}"
  force_destroy = !var.deletion_protection
}

data "aws_caller_identity" "current" {}
