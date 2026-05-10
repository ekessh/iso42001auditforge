# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "project" { type = string }
variable "region" { type = string }
variable "subnet_cidr" {
  type    = string
  default = "10.20.0.0/20"
}
