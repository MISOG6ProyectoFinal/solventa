locals {
  network          = data.terraform_remote_state.network.outputs
  subnets_por_zona = try(local.network.nat_gateway, true) ? local.network.private_subnet_ids : local.network.public_subnet_ids
  node_subnet_ids  = slice(local.subnets_por_zona, 0, coalesce(var.node_zones, length(local.subnets_por_zona)))
}

module "eks" {
  source = "../../modules/eks"

  cluster_name           = var.cluster_name
  cluster_version        = var.cluster_version
  vpc_id                 = local.network.vpc_id
  private_subnet_ids     = local.network.private_subnet_ids
  node_subnet_ids        = local.node_subnet_ids
  node_capacity_type     = var.node_capacity_type
  endpoint_public_access = var.endpoint_public_access
  node_instance_types    = var.node_instance_types
  nodes_per_zone         = var.nodes_per_zone
  cluster_iam_role_arn   = var.cluster_iam_role_arn
  node_iam_role_arn      = var.node_iam_role_arn

  control_plane_log_types          = var.control_plane_log_types
  control_plane_log_retention_days = var.control_plane_log_retention_days

  admin_principal_arns     = var.admin_principal_arns
  developer_principal_arns = var.developer_principal_arns
}
