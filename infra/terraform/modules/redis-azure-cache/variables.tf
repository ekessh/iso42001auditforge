# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "sku_name" {
  type    = string
  default = "Premium"
}
variable "capacity" {
  type    = number
  default = 1
}
