variable "prefix" {
  type    = string
  default = "solventa"
}

variable "rate_limit_per_5min" {
  description = "Solicitudes por IP cada 5 minutos antes de bloquear."
  type        = number
  default     = 2000
}
