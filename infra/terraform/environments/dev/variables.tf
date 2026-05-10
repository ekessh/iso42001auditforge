# SPDX-License-Identifier: BUSL-1.1
variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name_prefix" {
  type    = string
  default = "auditforge-dev"
}

variable "azs" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "tags" {
  type = map(string)
  default = {
    Project     = "auditforge"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
