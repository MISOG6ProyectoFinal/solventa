# Almacén de objetos de evidencia de siniestros. Inmutable tras la carga: la base
# de siniestros solo guarda Evidencia.url.
resource "aws_s3_bucket" "this" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Clave propia: el rol de los pods firma el PUT y S3 cifra con esta clave.
# La clave administrada de AWS no deja acotar kms:GenerateDataKey al bucket.
resource "aws_kms_key" "evidencias" {
  count = var.kms_encryption ? 1 : 0

  description             = "Cifrado de las evidencias de siniestros"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_encryption ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_encryption ? aws_kms_key.evidencias[0].arn : null
    }
    bucket_key_enabled = var.kms_encryption
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "https_only" {
  source_policy_documents = var.policy_json == null ? [] : [var.policy_json]

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.this.arn,
      "${aws_s3_bucket.this.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "https_only" {
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.https_only.json
}
