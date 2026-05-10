# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "compartment_id" { type = string }
variable "vcn_id" { type = string }
variable "kubernetes_version" {
  type    = string
  default = "v1.30.1"
}
