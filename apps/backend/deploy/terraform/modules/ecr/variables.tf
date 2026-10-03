variable "prefix" {
  description = "Prefijo de los repositorios (solventa/<servicio>)."
  type        = string
  default     = "solventa"
}

variable "repositories" {
  description = "Un repositorio por imagen de servicio."
  type        = list(string)
}

variable "keep_images" {
  type    = number
  default = 20
}

variable "force_delete" {
  description = "Permite destruir repositorios con imágenes (ambientes efímeros)."
  type        = bool
  default     = false
}
