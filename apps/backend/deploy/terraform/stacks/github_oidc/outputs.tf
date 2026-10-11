output "deploy_role_arn" {
  description = "Valor de la variable AWS_DEPLOY_ROLE_ARN del repositorio."
  value       = aws_iam_role.deploy.arn
}
