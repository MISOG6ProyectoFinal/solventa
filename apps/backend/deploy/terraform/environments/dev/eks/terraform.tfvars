region              = "us-east-1"
environment         = "dev"
state_bucket        = "solventa-tfstate-712589718837"
cluster_name        = "solventa-dev"
cluster_version     = "1.33"
node_instance_types = ["t3.large"]
nodes_per_zone      = { min = 1, desired = 1, max = 3 }

# Acceso a kubectl. El rol del pipeline crea el clúster y entra como administrador;
# las personas se agregan aquí.
admin_principal_arns     = ["arn:aws:iam::712589718837:user/jonatan-dev"]
developer_principal_arns = []

# AWS Academy: sin permisos de IAM, se reutiliza LabRole.
# cluster_iam_role_arn = "arn:aws:iam::<cuenta>:role/LabRole"
# node_iam_role_arn    = "arn:aws:iam::<cuenta>:role/LabRole"
