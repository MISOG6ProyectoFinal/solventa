locals {
  almacenes = nonsensitive(sort(keys(local.data.databases)))
  crear_bases = join("\n", [
    for nombre in local.almacenes :
    "psql -tAc \"SELECT 1 FROM pg_database WHERE datname = '${nombre}'\" | grep -q 1 || psql -c 'CREATE DATABASE \"${nombre}\"'"
  ])
}

resource "kubernetes_job_v1" "crear_bases" {
  count = try(local.data.shared_instance, false) ? 1 : 0

  metadata {
    name      = "crear-bases-${substr(sha1(join(",", local.almacenes)), 0, 8)}"
    namespace = kubernetes_namespace.solventa.metadata[0].name
  }

  spec {
    backoff_limit = 4
    template {
      metadata {}
      spec {
        restart_policy       = "Never"
        enable_service_links = false
        container {
          name    = "psql"
          image   = "postgres:17-alpine"
          command = ["sh", "-ec", local.crear_bases]

          env {
            name = "PGHOST"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db[local.almacenes[0]].metadata[0].name
                key  = "DB_HOST"
              }
            }
          }
          env {
            name = "PGUSER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db[local.almacenes[0]].metadata[0].name
                key  = "DB_USER"
              }
            }
          }
          env {
            name = "PGPASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db[local.almacenes[0]].metadata[0].name
                key  = "DB_PASSWORD"
              }
            }
          }
          env {
            name  = "PGDATABASE"
            value = "postgres"
          }
        }
      }
    }
  }

  wait_for_completion = true

  timeouts {
    create = "5m"
  }
}
