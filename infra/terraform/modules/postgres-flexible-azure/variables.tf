# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "sku" {
  type    = string
  default = "GP_Standard_D4s_v3"
}
variable "storage_mb" {
  type    = number
  default = 131072
}
variable "tags" {
  type    = map(string)
  default = {}
}
