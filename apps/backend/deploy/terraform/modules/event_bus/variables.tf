variable "prefix" {
  type    = string
  default = "solventa"
}

variable "consumers" {
  description = "Suscriptores del bus. event_types = null recibe todos los eventos."
  type = map(object({
    event_types          = optional(list(string))
    visibility_timeout_s = optional(number, 60)
  }))
}

variable "max_receive_count" {
  description = "Intentos antes de mover el mensaje a la DLQ."
  type        = number
  default     = 3
}

variable "alarm_actions" {
  description = "ARNs (p. ej. tópico SNS de guardia) a notificar cuando una DLQ recibe mensajes."
  type        = list(string)
  default     = []
}
