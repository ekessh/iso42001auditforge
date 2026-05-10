# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.50.0" }
  }
}

resource "aws_secretsmanager_secret" "this" {
  name                    = var.name
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 30
  tags                    = var.tags
}
