output "instance_id" {
  value = aws_instance.k3s.id
}

output "public_dns" {
  description = "Origen de la API para CloudFront (stack edge)."
  value       = aws_eip.k3s.public_dns
}

output "kubeconfig_parameter" {
  value = aws_ssm_parameter.kubeconfig.name
}

output "evidencias_bucket" {
  value = module.evidencias.bucket
}
