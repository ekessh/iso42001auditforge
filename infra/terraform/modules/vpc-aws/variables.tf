# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "cidr" {
  type    = string
  default = "10.0.0.0/16"
}
variable "azs" { type = list(string) }
variable "private_subnets" { type = list(string) }
variable "public_subnets"  { type = list(string) }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "flow_logs_bucket_arn" {
  type    = string
  default = ""
}
