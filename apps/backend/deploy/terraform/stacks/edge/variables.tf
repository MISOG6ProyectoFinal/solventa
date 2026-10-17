variable "modo_despliegue" {
  description = "ahorro (k3s en una EC2) o eks-costoso (EKS con NLB y WAF). Lo fija deploy-aws.sh."
  type        = string
  default     = "ahorro"
  validation {
    condition     = contains(["ahorro", "eks-costoso"], var.modo_despliegue)
    error_message = "modo_despliegue debe ser ahorro o eks-costoso."
  }
}

variable "prefix" {
  type    = string
  default = "solventa"
}

variable "rate_limit_per_5min" {
  description = "Solicitudes por IP cada 5 minutos antes de bloquear."
  type        = number
  default     = 2000
}

variable "api_paths" {
  description = "Rutas que van al API Gateway; el resto lo sirve el portal."
  type        = list(string)
  default     = ["/web/*", "/movil/*", "/socios/*"]
}
