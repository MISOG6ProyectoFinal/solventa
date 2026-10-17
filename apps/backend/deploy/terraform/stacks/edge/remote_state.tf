data "terraform_remote_state" "eks" {
  count   = var.modo_despliegue == "eks-costoso" ? 1 : 0
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "eks/terraform.tfstate"
    region = var.region
  }
}

data "terraform_remote_state" "ahorro" {
  count   = var.modo_despliegue == "ahorro" ? 1 : 0
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "ahorro/terraform.tfstate"
    region = var.region
  }
}
