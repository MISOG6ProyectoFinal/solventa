module "eks" {
  source = "../../modules/eks"

  cluster_name           = var.cluster_name
  cluster_version        = var.cluster_version
  vpc_id                 = data.terraform_remote_state.network.outputs.vpc_id
  private_subnet_ids     = data.terraform_remote_state.network.outputs.private_subnet_ids
  endpoint_public_access = var.endpoint_public_access
  node_instance_types    = var.node_instance_types
  nodes_per_zone         = var.nodes_per_zone
  cluster_iam_role_arn   = var.cluster_iam_role_arn
  node_iam_role_arn      = var.node_iam_role_arn
}
