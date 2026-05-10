# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "kubernetes_version" {
  type    = string
  default = "1.30"
}
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "node_instance_types" {
  type    = list(string)
  default = ["m6i.xlarge"]
}
variable "node_min_size" {
  type    = number
  default = 2
}
variable "node_max_size" {
  type    = number
  default = 10
}
variable "node_desired_size" {
  type    = number
  default = 3
}
variable "tags" {
  type    = map(string)
  default = {}
}
