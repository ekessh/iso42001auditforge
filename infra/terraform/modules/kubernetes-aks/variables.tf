# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "kubernetes_version" {
  type    = string
  default = "1.30"
}
variable "node_count" {
  type    = number
  default = 3
}
variable "vm_size" {
  type    = string
  default = "Standard_D4s_v5"
}
variable "tags" {
  type    = map(string)
  default = {}
}
