output "url" {
  description = "URL para redis-py (TLS en tránsito)."
  value       = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379/0"
}
