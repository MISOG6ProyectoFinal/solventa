variable "region" {
  description = "Región primaria de AWS."
  type        = string
}

variable "environment" {
  description = "Nombre del ambiente (dev, staging, prod)."
  type        = string
}

variable "github_repository" {
  description = "Repositorio que puede asumir el rol, como <organización>/<repo>."
  type        = string
}

variable "deploy_branch" {
  description = "Rama desde la que se aplica la infraestructura."
  type        = string
  default     = "main"
}

variable "release_tag_pattern" {
  description = "Tags de release que disparan el despliegue."
  type        = string
  default     = "v*"
}
