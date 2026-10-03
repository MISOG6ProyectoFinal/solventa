variable "prefix" {
  type    = string
  default = "solventa"
}

variable "stores" {
  description = "Almacenes relacionales. La clave es el nombre de la base y del Secret db-<clave>."
  type = map(object({
    instance_class = optional(string, "db.t4g.medium")
    multi_az       = optional(bool, true)
    read_replica   = optional(bool, false)
    enable_proxy   = optional(bool, true)
  }))
}

variable "proxy_role_arn" {
  description = "Rol existente para RDS Proxy (cuentas sin permisos de IAM). null = se crea."
  type        = string
  default     = null
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "redis_node_count" {
  type    = number
  default = 2
}

variable "deletion_protection" {
  type    = bool
  default = true
}
