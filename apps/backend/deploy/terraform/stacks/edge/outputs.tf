output "url" {
  description = "Direccion publica del portal y de la API. Se inyecta en el build del portal."
  value       = "https://${aws_cloudfront_distribution.edge.domain_name}"
}

output "web_bucket" {
  value = module.web.bucket
}

output "distribution_id" {
  value = aws_cloudfront_distribution.edge.id
}
