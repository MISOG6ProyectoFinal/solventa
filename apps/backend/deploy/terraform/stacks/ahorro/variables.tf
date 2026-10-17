variable "prefix" {
  type    = string
  default = "solventa"
}

variable "instance_type" {
  description = "Tipo de la instancia de k3s. Las imagenes son linux/amd64."
  type        = string
  default     = "t3.medium"
}

variable "spot" {
  description = "Instancia spot persistente: ante una interrupcion se detiene y conserva el disco."
  type        = bool
  default     = true
}

variable "root_volume_gb" {
  type    = number
  default = 30
}

variable "k3s_version" {
  type    = string
  default = "v1.35.9+k3s1"
}

variable "almacenes" {
  description = "Una base por almacen dentro del Postgres del cluster (Database-per-Service)."
  type        = list(string)
  default     = ["cotizacion", "polizas", "siniestros", "identidad", "pagos", "auditoria"]
}
