# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "project" { type = string }
variable "region" { type = string }
variable "tier" {
  type    = string
  default = "db-custom-4-16384"
}
variable "tags" {
  type    = map(string)
  default = {}
}
