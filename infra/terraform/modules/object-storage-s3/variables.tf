# SPDX-License-Identifier: BUSL-1.1

variable "name_prefix" { type = string }
variable "kms_key_arn" { type = string }
variable "object_lock_years" {
  type    = number
  default = 10
}
variable "tags" {
  type    = map(string)
  default = {}
}
