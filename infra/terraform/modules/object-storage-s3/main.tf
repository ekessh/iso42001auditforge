# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.50.0" }
  }
}

resource "aws_s3_bucket" "evidence" {
  bucket              = "${var.name_prefix}-evidence"
  object_lock_enabled = true
  tags                = var.tags
}

resource "aws_s3_bucket" "archive" {
  bucket              = "${var.name_prefix}-archive"
  object_lock_enabled = true
  tags                = var.tags
}

resource "aws_s3_bucket" "reports" {
  bucket = "${var.name_prefix}-reports"
  tags   = var.tags
}

locals {
  buckets = {
    evidence = aws_s3_bucket.evidence.id
    archive  = aws_s3_bucket.archive.id
    reports  = aws_s3_bucket.reports.id
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = local.buckets
  bucket   = each.value
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = local.buckets
  bucket   = each.value
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each                = local.buckets
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    default_retention {
      mode  = "COMPLIANCE"
      years = var.object_lock_years
    }
  }
}

resource "aws_s3_bucket_object_lock_configuration" "archive" {
  bucket = aws_s3_bucket.archive.id
  rule {
    default_retention {
      mode  = "COMPLIANCE"
      years = var.object_lock_years
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = local.buckets
  bucket   = each.value
  rule {
    id     = "transition-glacier"
    status = "Enabled"
    filter {
      prefix = ""
    }
    transition {
      days          = 365
      storage_class = "GLACIER_IR"
    }
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}
