# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "project" { type = string }
variable "region" { type = string }
variable "network" { type = string }
variable "subnetwork" { type = string }
variable "node_count" {
  type    = number
  default = 3
}
variable "machine_type" {
  type    = string
  default = "n2-standard-4"
}
