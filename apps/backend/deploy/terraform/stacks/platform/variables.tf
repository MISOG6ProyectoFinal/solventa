variable "create_iam" {
  description = "false en cuentas sin permisos de IAM: los pods usan el rol de los nodos (p. ej. LabRole)."
  type        = bool
  default     = true
}
