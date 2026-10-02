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
  description = "Una subred privada por zona; se crea un node group en cada una."
  type        = list(string)
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
