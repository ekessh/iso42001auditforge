# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.50.0" }
  }
}

resource "aws_kms_key" "this" {
  description              = "AuditForge ${var.name} signing-key wrap CMK"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage                = "ENCRYPT_DECRYPT"
  enable_key_rotation      = true
  deletion_window_in_days  = 30
  multi_region             = true
  tags                     = var.tags
}

resource "aws_kms_alias" "this" {
  name          = "alias/auditforge-${var.name}"
  target_key_id = aws_kms_key.this.id
}
