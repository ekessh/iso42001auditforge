# SPDX-License-Identifier: BUSL-1.1

variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
