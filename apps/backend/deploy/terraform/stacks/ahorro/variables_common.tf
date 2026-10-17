variable "region" {
  description = "Región primaria de AWS."
  type        = string
}

variable "environment" {
  description = "Nombre del ambiente (dev, staging, prod)."
  type        = string
}

variable "state_bucket" {
  description = "Bucket S3 con los estados de los demás stacks."
  type        = string
}
