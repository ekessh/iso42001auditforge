# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "node_type" {
  type    = string
  default = "cache.r7g.large"
}
variable "num_cache_clusters" {
  type    = number
  default = 2
}
variable "kms_key_arn" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
