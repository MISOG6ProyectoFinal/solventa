output "databases" {
  description = "Conexión por almacén; la consume el stack platform para crear los Secret db-*."
  sensitive   = true
  value = {
    for name, db in module.postgres : name => {
      host      = db.endpoint
      port      = db.port
      name      = db.db_name
      username  = db.username
      password  = db.password
      read_host = db.read_endpoint
    }
  }
}

output "redis_url" {
  value = module.redis.url
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
