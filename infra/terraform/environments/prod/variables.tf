# SPDX-License-Identifier: BUSL-1.1
variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name_prefix" {
  type    = string
  default = "auditforge-prod"
}

variable "azs" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "tags" {
  type = map(string)
  default = {
    Project     = "auditforge"
    Environment = "prod"
    ManagedBy   = "terraform"
    Compliance  = "ISO42001-target"
  }
}
