# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "project" { type = string }
variable "region" { type = string }
variable "tier" {
  type    = string
  default = "STANDARD_HA"
}
variable "memory_size_gb" {
  type    = number
  default = 5
}
