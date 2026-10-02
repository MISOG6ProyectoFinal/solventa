output "load_balancer_hostname" {
  description = "NLB del API Gateway. Origen del stack edge."
  value       = try(data.kubernetes_service.ingress.status[0].load_balancer[0].ingress[0].hostname, null)
}
