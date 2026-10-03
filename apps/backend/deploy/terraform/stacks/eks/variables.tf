variable "cluster_name" {
  type = string
}

variable "cluster_version" {
  type    = string
  default = "1.33"
}

variable "endpoint_public_access" {
  type    = bool
  default = true
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.large"]
}

variable "nodes_per_zone" {
  type = object({ min = number, desired = number, max = number })
}

variable "cluster_iam_role_arn" {
  type    = string
  default = null
}

variable "node_iam_role_arn" {
  type    = string
  default = null
}
