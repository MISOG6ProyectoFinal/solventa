output "bucket" {
  value = aws_s3_bucket.this.bucket
}

output "arn" {
  value = aws_s3_bucket.this.arn
}

output "regional_domain_name" {
  value = aws_s3_bucket.this.bucket_regional_domain_name
}

output "kms_key_arn" {
  value = var.kms_encryption ? aws_kms_key.evidencias[0].arn : null
}
