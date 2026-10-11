output "deploy_role_arn" {
  description = "Valor de la variable AWS_DEPLOY_ROLE_ARN del repositorio."
  value       = aws_iam_role.deploy.arn
}

output "cluster_admin_role_arn" {
  description = "Rol que asumen los miembros del grupo para entrar al cluster."
  value       = aws_iam_role.cluster_admin.arn
}
