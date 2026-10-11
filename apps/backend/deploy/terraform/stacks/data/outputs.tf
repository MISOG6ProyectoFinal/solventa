output "databases" {
  description = "Conexión por almacén; la consume el stack platform para crear los Secret db-*."
  sensitive   = true
  value = {
    for name in keys(var.stores) : name => {
      host      = module.postgres[var.shared_instance == null ? name : local.instancia_compartida].endpoint
      port      = module.postgres[var.shared_instance == null ? name : local.instancia_compartida].port
      name      = name
      username  = module.postgres[var.shared_instance == null ? name : local.instancia_compartida].username
      password  = module.postgres[var.shared_instance == null ? name : local.instancia_compartida].password
      read_host = module.postgres[var.shared_instance == null ? name : local.instancia_compartida].read_endpoint
    }
  }
}

output "shared_instance" {
  description = "true cuando todos los almacenes son bases de una misma instancia; platform las crea."
  value       = var.shared_instance != null
}

output "redis_url" {
  value = var.redis_enabled ? module.redis[0].url : ""
}

output "evidencias_bucket" {
  value = module.evidencias.bucket
}

output "evidencias_bucket_arn" {
  value = module.evidencias.arn
}

output "evidencias_kms_key_arn" {
  value = module.evidencias.kms_key_arn
}
