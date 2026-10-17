# Borde de red del modelo de despliegue: CDN y WAF delante del API Gateway.
# En eks-costoso el origen es el NLB de NGINX Ingress; en ahorro, la instancia de k3s.
data "kubernetes_service" "ingress" {
  count = local.eks ? 1 : 0

  metadata {
    name      = "ingress-nginx-controller"
    namespace = "ingress-nginx"
  }
}

locals {
  eks         = var.modo_despliegue == "eks-costoso"
  origin_host = local.eks ? data.kubernetes_service.ingress[0].status[0].load_balancer[0].ingress[0].hostname : data.terraform_remote_state.ahorro[0].outputs.public_dns
}

moved {
  from = aws_wafv2_web_acl.edge
  to   = aws_wafv2_web_acl.edge[0]
}

resource "aws_wafv2_web_acl" "edge" {
  count = local.eks || var.conservar_waf ? 1 : 0

  name  = "${var.prefix}-edge"
  scope = "CLOUDFRONT" # Requiere region = us-east-1.

  default_action {
    allow {}
  }

  rule {
    name     = "aws-common"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-known-bad-inputs"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit-por-ip"
    priority = 3
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-por-ip"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.prefix}-edge"
    sampled_requests_enabled   = true
  }
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewerExceptHostHeader"
}

module "web" {
  source = "../../modules/object_storage"

  bucket_name    = "${var.prefix}-${var.environment}-web-${data.aws_caller_identity.current.account_id}"
  force_destroy  = true
  kms_encryption = false
  policy_json    = data.aws_iam_policy_document.web_bucket.json
}

data "aws_caller_identity" "current" {}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.prefix}-${var.environment}-web"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "web_bucket" {
  statement {
    sid       = "SoloCloudFront"
    actions   = ["s3:GetObject"]
    resources = ["${module.web.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.edge.arn]
    }
  }
}

removed {
  from = aws_s3_bucket_policy.web
  lifecycle {
    destroy = false
  }
}

resource "aws_cloudfront_function" "spa_routes" {
  name    = "${var.prefix}-${var.environment}-spa-routes"
  runtime = "cloudfront-js-2.0"
  comment = "Rutas del portal sin extension se sirven con index.html"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      if (!request.uri.split('/').pop().includes('.')) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

locals {
  api_origin = "api-gateway"
  web_origin = "web"
}

resource "aws_cloudfront_distribution" "edge" {
  enabled             = true
  comment             = "Solventa: portal web y API (BFF web, BFF movil, API de socios)"
  price_class         = "PriceClass_100"
  web_acl_id          = local.eks ? aws_wafv2_web_acl.edge[0].arn : null
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  origin {
    domain_name              = module.web.regional_domain_name
    origin_id                = local.web_origin
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    domain_name = local.origin_host
    origin_id   = local.api_origin
    custom_origin_config {
      http_port  = 80
      https_port = 443
      # El NLB todavía no tiene certificado. El origen sigue en claro hasta que exista un dominio propio.
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.web_origin
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_routes.arn
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.api_paths
    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = local.api_origin
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
