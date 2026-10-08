# Une la infraestructura con los manifiestos de deploy/k8s: namespace, ConfigMap
# solventa-platform, Secret db-<almacén> y permisos AWS de los pods (EKS Pod Identity).
locals {
  cluster    = data.terraform_remote_state.eks.outputs.cluster_name
  data       = data.terraform_remote_state.data.outputs
  messaging  = data.terraform_remote_state.messaging.outputs
  namespace  = "solventa"
  queue_keys = { for k, url in local.messaging.queue_urls : "QUEUE_URL_${upper(replace(k, "-", "_"))}" => url }
}

resource "kubernetes_namespace" "solventa" {
  metadata {
    name = local.namespace
    labels = {
      "app.kubernetes.io/part-of" = "solventa"
    }
  }
}

resource "kubernetes_config_map" "platform" {
  metadata {
    name      = "solventa-platform"
    namespace = kubernetes_namespace.solventa.metadata[0].name
  }

  data = merge({
    ENVIRONMENT       = var.environment
    AWS_REGION        = var.region
    REDIS_URL         = local.data.redis_url
    EVENTS_TOPIC_ARN  = local.messaging.topic_arn
    EVIDENCIAS_BUCKET = local.data.evidencias_bucket
  }, local.queue_keys)
}

resource "kubernetes_secret" "db" {
  for_each = nonsensitive(toset(keys(local.data.databases)))

  metadata {
    name      = "db-${each.key}"
    namespace = kubernetes_namespace.solventa.metadata[0].name
  }

  data = {
    DB_HOST     = local.data.databases[each.key].host
    DB_PORT     = tostring(local.data.databases[each.key].port)
    DB_NAME     = local.data.databases[each.key].name
    DB_USER     = local.data.databases[each.key].username
    DB_PASSWORD = local.data.databases[each.key].password
  }
}

# ---------- Permisos AWS de los pods

data "aws_iam_policy_document" "pod_identity_assume" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]
    principals {
      type        = "Service"
      identifiers = ["pods.eks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "backend" {
  statement {
    sid       = "PublicarEnElBus"
    actions   = ["sns:Publish"]
    resources = [local.messaging.topic_arn]
  }
  statement {
    sid       = "ConsumirColas"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"]
    resources = values(local.messaging.queue_arns)
  }
  statement {
    sid       = "Evidencias"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${local.data.evidencias_bucket_arn}/*"]
  }
  statement {
    sid       = "CifrarEvidencias"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [local.data.evidencias_kms_key_arn]
  }
}

resource "aws_iam_role" "backend" {
  count              = var.create_iam ? 1 : 0
  name               = "${local.cluster}-solventa-backend"
  assume_role_policy = data.aws_iam_policy_document.pod_identity_assume.json
}

resource "aws_iam_role_policy" "backend" {
  count  = var.create_iam ? 1 : 0
  role   = aws_iam_role.backend[0].id
  policy = data.aws_iam_policy_document.backend.json
}

resource "aws_eks_pod_identity_association" "backend" {
  count           = var.create_iam ? 1 : 0
  cluster_name    = local.cluster
  namespace       = local.namespace
  service_account = "solventa-backend"
  role_arn        = aws_iam_role.backend[0].arn
}

data "aws_iam_policy_document" "keda" {
  statement {
    actions   = ["sqs:GetQueueAttributes"]
    resources = values(local.messaging.queue_arns)
  }
}

resource "aws_iam_role" "keda" {
  count              = var.create_iam ? 1 : 0
  name               = "${local.cluster}-keda-operator"
  assume_role_policy = data.aws_iam_policy_document.pod_identity_assume.json
}

resource "aws_iam_role_policy" "keda" {
  count  = var.create_iam ? 1 : 0
  role   = aws_iam_role.keda[0].id
  policy = data.aws_iam_policy_document.keda.json
}

resource "aws_eks_pod_identity_association" "keda" {
  count           = var.create_iam ? 1 : 0
  cluster_name    = local.cluster
  namespace       = "keda"
  service_account = "keda-operator"
  role_arn        = aws_iam_role.keda[0].arn
}
