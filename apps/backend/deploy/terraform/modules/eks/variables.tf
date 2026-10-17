variable "cluster_name" {
  type = string
}

variable "cluster_version" {
  type    = string
  default = "1.33"
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  description = "Subredes privadas del plano de control, una por zona."
  type        = list(string)
}

variable "node_subnet_ids" {
  description = "Subredes de los nodos; se crea un node group en cada una."
  type        = list(string)
}

variable "node_capacity_type" {
  description = "ON_DEMAND o SPOT."
  type        = string
  default     = "ON_DEMAND"
}

variable "endpoint_public_access" {
  type    = bool
  default = true
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.large"]
}

variable "nodes_per_zone" {
  type = object({ min = number, desired = number, max = number })
  default = {
    min     = 1
    desired = 2
    max     = 5
  }
}

variable "cluster_iam_role_arn" {
  description = "Rol existente para el clúster (p. ej. LabRole). null = Terraform lo crea."
  type        = string
  default     = null
}

variable "node_iam_role_arn" {
  description = "Rol existente para los nodos. null = Terraform lo crea."
  type        = string
  default     = null
}

variable "admin_principal_arns" {
  description = "Usuarios o roles de IAM con administración completa del clúster, además de quien lo crea."
  type        = list(string)
  default     = []
}

variable "developer_principal_arns" {
  description = "Usuarios o roles de IAM que despliegan en developer_namespaces."
  type        = list(string)
  default     = []
}

variable "developer_namespaces" {
  type    = list(string)
  default = ["solventa"]
}

variable "control_plane_log_types" {
  description = "Logs del plano de control enviados a CloudWatch: api, audit, authenticator, controllerManager, scheduler."
  type        = list(string)
  default     = ["api", "audit", "authenticator"]
}

variable "control_plane_log_retention_days" {
  type    = number
  default = 30
}
