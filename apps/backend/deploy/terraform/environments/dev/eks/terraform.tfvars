region              = "us-east-1"
environment         = "dev"
state_bucket        = "solventa-g6-terraform-state-dev"
cluster_name        = "solventa-dev"
cluster_version     = "1.33"
node_instance_types = ["t3.large", "t3a.large"]
node_capacity_type  = "SPOT"
node_zones          = 1
nodes_per_zone      = { min = 1, desired = 1, max = 2 }

control_plane_log_types = []

admin_principal_arns     = ["arn:aws:iam::712589718837:role/solventa-dev-cluster-admin"]
developer_principal_arns = []

# AWS Academy: sin permisos de IAM, se reutiliza LabRole.
# cluster_iam_role_arn = "arn:aws:iam::<cuenta>:role/LabRole"
# node_iam_role_arn    = "arn:aws:iam::<cuenta>:role/LabRole"
