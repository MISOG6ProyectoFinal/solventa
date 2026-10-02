output "namespace" {
  value = kubernetes_namespace.solventa.metadata[0].name
}

output "queue_config_keys" {
  description = "Claves QUEUE_URL_* del ConfigMap; deben coincidir con los consumidores en deploy/k8s."
  value       = keys(local.queue_keys)
}
