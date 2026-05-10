# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "instance_class" {
  type    = string
  default = "db.r6g.large"
}
variable "allocated_storage" {
  type    = number
  default = 100
}
variable "multi_az" {
  type    = bool
  default = true
}
variable "backup_retention_days" {
  type    = number
  default = 90
}
variable "kms_key_arn" { type = string }
variable "engine_version" {
  type    = string
  default = "16.4"
}
variable "tags" {
  type    = map(string)
  default = {}
}
