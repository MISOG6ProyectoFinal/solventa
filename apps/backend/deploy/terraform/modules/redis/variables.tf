variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  type = list(string)
}

variable "node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "node_count" {
  description = "Primaria + réplicas. Con 2 o más se reparte entre zonas con failover automático."
  type        = number
  default     = 2
}
