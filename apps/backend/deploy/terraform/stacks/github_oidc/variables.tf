variable "region" {
  description = "Región primaria de AWS."
  type        = string
}

variable "environment" {
  description = "Nombre del ambiente (dev, staging, prod)."
  type        = string
}

variable "github_repository" {
  description = "Repositorio donde se configuran el Environment y las variables, como <organización>/<repo>."
  type        = string
}

variable "github_subject_prefix" {
  description = "Prefijo del claim sub del token OIDC. Sale de: gh api repos/<org>/<repo>/actions/oidc/customization/sub. Con sujeto inmutable incluye los ids: repo:<org>@<id>/<repo>@<id>."
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
