# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "compartment_id" { type = string }
variable "cidr_blocks" {
  type    = list(string)
  default = ["10.30.0.0/16"]
}
