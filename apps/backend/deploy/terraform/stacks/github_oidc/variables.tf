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
  description = "Única rama desde la que el pipeline publica imágenes."
  type        = string
  default     = "main"
}
