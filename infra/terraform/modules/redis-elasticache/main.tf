# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    aws    = { source = "hashicorp/aws",    version = ">= 5.50.0" }
    random = { source = "hashicorp/random", version = ">= 3.6.0" }
  }
}

resource "random_password" "auth" {
  length  = 64
  special = false
}

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "this" {
  name   = "${var.name}-sg"
  vpc_id = var.vpc_id
  tags   = var.tags
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = var.name
  description                = "AuditForge ${var.name}"
  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = true
  multi_az_enabled           = true
  engine                     = "redis"
  engine_version             = "7.1"
  parameter_group_name       = "default.redis7"
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.this.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn
  auth_token                 = random_password.auth.result
  snapshot_retention_limit   = 7
  tags                       = var.tags
}
