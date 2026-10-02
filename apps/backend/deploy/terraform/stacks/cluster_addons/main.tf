# Complementos del clúster que los manifiestos de deploy/k8s dan por existentes.

# API Gateway del modelo: NGINX Ingress detrás de un NLB que cruza zonas.
resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = var.ingress_nginx_version
  namespace        = "ingress-nginx"
  create_namespace = true
  wait             = true
  timeout          = 600

  values = [yamlencode({
    controller = {
      replicaCount = 2
      topologySpreadConstraints = [{
        maxSkew           = 1
        topologyKey       = "topology.kubernetes.io/zone"
        whenUnsatisfiable = "ScheduleAnyway"
        labelSelector = { matchLabels = {
          "app.kubernetes.io/name"      = "ingress-nginx"
          "app.kubernetes.io/component" = "controller"
        } }
      }]
      service = {
        annotations = {
          "service.beta.kubernetes.io/aws-load-balancer-type"                              = "nlb"
          "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled" = "true"
        }
      }
      config = {
        # El borde (CloudFront) envía la IP real del cliente.
        "use-forwarded-headers" = "true"
      }
    }
  })]
}

# Escala los Workers Siniestro Paramétrico por profundidad de cola (deploy/k8s/overlays/aws/keda-workers.yaml).
resource "helm_release" "keda" {
  name             = "keda"
  repository       = "https://kedacore.github.io/charts"
  chart            = "keda"
  version          = var.keda_version
  namespace        = "keda"
  create_namespace = true
  wait             = true
}

# Métricas de CPU para los HorizontalPodAutoscaler.
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  version    = var.metrics_server_version
  namespace  = "kube-system"
  wait       = true
}

data "kubernetes_service" "ingress" {
  metadata {
    name      = "ingress-nginx-controller"
    namespace = "ingress-nginx"
  }
  depends_on = [helm_release.ingress_nginx]
}
