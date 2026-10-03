output "endpoint" {
  description = "Host al que se conectan los servicios: el proxy si existe, si no la primaria."
  value       = var.enable_proxy ? aws_db_proxy.this[0].endpoint : aws_db_instance.primary.address
}

output "read_endpoint" {
  value = var.read_replica ? aws_db_instance.read_replica[0].address : null
}

output "port" {
  value = aws_db_instance.primary.port
}

output "db_name" {
  value = aws_db_instance.primary.db_name
}

output "username" {
  value = var.username
}

output "password" {
  value     = random_password.master.result
  sensitive = true
}

output "secret_arn" {
  value = aws_secretsmanager_secret.master.arn
}
