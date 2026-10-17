variable "bucket_name" {
  type = string
}

variable "force_destroy" {
  type    = bool
  default = false
}

variable "kms_encryption" {
  description = "true cifra con una clave KMS propia; false usa el cifrado administrado de S3."
  type        = bool
  default     = true
}

variable "policy_json" {
  description = "Declaraciones adicionales para la politica del bucket; se combinan con la regla de solo HTTPS."
  type        = string
  default     = null
}
