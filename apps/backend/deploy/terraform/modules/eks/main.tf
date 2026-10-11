# Clúster de contenedores de la región primaria. Un node group por zona de
# disponibilidad mantiene la capacidad de ambas zonas aunque una se degrade.
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.37"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids

  cluster_endpoint_public_access           = var.endpoint_public_access
  enable_cluster_creator_admin_permissions = true

  # Acceso a kubectl para el resto del equipo. Los permisos de IAM no lo dan.
  access_entries = merge(
    { for arn in var.admin_principal_arns : "admin-${basename(arn)}" => {
      principal_arn = arn
      policy_associations = { admin = {
        policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
        access_scope = { type = "cluster" }
      } }
    } },
    { for arn in var.developer_principal_arns : "dev-${basename(arn)}" => {
      principal_arn = arn
      policy_associations = { edit = {
        policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy"
        access_scope = { type = "namespace", namespaces = var.developer_namespaces }
      } }
    } },
  )

  # En cuentas sin permisos de IAM (AWS Academy) se reutiliza un rol existente.
  create_iam_role = var.cluster_iam_role_arn == null
  iam_role_arn    = var.cluster_iam_role_arn
  enable_irsa     = var.cluster_iam_role_arn == null

  cluster_addons = {
    coredns                = {}
    kube-proxy             = {}
    eks-pod-identity-agent = {}
    vpc-cni = {
      before_compute = true
      # Habilita NetworkPolicy (deploy/k8s/base/network-policy.yaml).
      configuration_values = jsonencode({ enableNetworkPolicy = "true" })
    }
  }

  eks_managed_node_groups = {
    for idx, subnet in var.private_subnet_ids : "zona-${idx}" => {
      subnet_ids     = [subnet]
      instance_types = var.node_instance_types
      ami_type       = "AL2023_x86_64_STANDARD"
      min_size       = var.nodes_per_zone.min
      desired_size   = var.nodes_per_zone.desired
      max_size       = var.nodes_per_zone.max

      create_iam_role = var.node_iam_role_arn == null
      iam_role_arn    = var.node_iam_role_arn
      iam_role_additional_policies = var.node_iam_role_arn == null ? {
        ssm = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
      } : {}
    }
  }
}
