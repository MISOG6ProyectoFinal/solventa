data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "cluster_admin_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
}

resource "aws_iam_role" "cluster_admin" {
  name               = "solventa-${var.environment}-cluster-admin"
  description        = "Acceso al cluster EKS para el grupo ${var.cluster_admin_group}"
  assume_role_policy = data.aws_iam_policy_document.cluster_admin_trust.json
}

data "aws_iam_policy_document" "cluster_admin" {
  statement {
    actions   = ["eks:DescribeCluster", "eks:ListClusters", "eks:AccessKubernetesApi", "eks:Describe*", "eks:List*"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cluster_admin" {
  name   = "eks-console"
  role   = aws_iam_role.cluster_admin.id
  policy = data.aws_iam_policy_document.cluster_admin.json
}

data "aws_iam_policy_document" "assume_cluster_admin" {
  statement {
    actions   = ["sts:AssumeRole"]
    resources = [aws_iam_role.cluster_admin.arn]
  }
}

resource "aws_iam_group_policy" "assume_cluster_admin" {
  name   = "assume-${aws_iam_role.cluster_admin.name}"
  group  = var.cluster_admin_group
  policy = data.aws_iam_policy_document.assume_cluster_admin.json
}
