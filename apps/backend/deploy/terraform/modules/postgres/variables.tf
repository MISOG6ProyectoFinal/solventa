variable "prefix" {
  type = string
}

variable "name" {
  description = "Nombre del almacén (cotizacion, polizas, siniestros, identidad, pagos, auditoria). También es el nombre de la base."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "db_subnet_group_name" {
  type = string
}

variable "subnet_ids" {
  description = "Subredes de base de datos, para RDS Proxy."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups con acceso a PostgreSQL (nodos EKS)."
  type        = list(string)
}

variable "engine_version" {
  type    = string
  default = "17"
}

variable "instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "allocated_storage_gb" {
  type    = number
  default = 20
}

variable "username" {
  type    = string
  default = "solventa"
}

variable "multi_az" {
  type    = bool
  default = true
}

variable "read_replica" {
  type    = bool
  default = false
}

variable "enable_proxy" {
  type    = bool
  default = true
}

variable "proxy_role_arn" {
  description = "Rol existente para RDS Proxy (p. ej. LabRole). null = Terraform lo crea."
  type        = string
  default     = null
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "deletion_protection" {
  type    = bool
  default = true
}
