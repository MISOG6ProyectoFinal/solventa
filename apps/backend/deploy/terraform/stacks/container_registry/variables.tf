variable "services" {
  description = "Imágenes de servicio (nombre del directorio en services/ con guiones)."
  type        = list(string)
}

variable "force_delete" {
  type    = bool
  default = false
}
