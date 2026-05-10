# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "address_space" {
  type    = list(string)
  default = ["10.10.0.0/16"]
}
variable "subnet_prefixes" {
  type    = list(string)
  default = ["10.10.1.0/24", "10.10.2.0/24"]
}
variable "tags" {
  type    = map(string)
  default = {}
}
