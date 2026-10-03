output "repository_urls" {
  value = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "registry" {
  description = "Host del registro, para docker login y kustomize."
  value       = split("/", values(aws_ecr_repository.this)[0].repository_url)[0]
}
