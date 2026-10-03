variable "prefix" {
  type    = string
  default = "solventa"
}

variable "consumers" {
  description = "Suscriptores del bus (clave = nombre del consumidor en Kubernetes)."
  type = map(object({
    event_types          = optional(list(string))
    visibility_timeout_s = optional(number, 60)
  }))
}

variable "max_receive_count" {
  type    = number
  default = 3
}

variable "alarm_actions" {
  type    = list(string)
  default = []
}
