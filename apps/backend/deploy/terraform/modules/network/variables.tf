variable "name" {
  description = "Prefijo de los recursos de red."
  type        = string
}

variable "cidr" {
  description = "Bloque CIDR de la VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Zonas de disponibilidad. El modelo de despliegue usa dos (A y B)."
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "true = una NAT compartida (más barato, sin aislamiento por zona)."
  type        = bool
  default     = false
}
