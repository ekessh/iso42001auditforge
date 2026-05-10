# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    aws    = { source = "hashicorp/aws",    version = ">= 5.50.0" }
    random = { source = "hashicorp/random", version = ">= 3.6.0" }
  }
}

resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "password" {
  name       = "${var.name}-pg-master"
  kms_key_id = var.kms_key_arn
  tags       = var.tags
}

resource "aws_secretsmanager_secret_version" "password" {
  secret_id     = aws_secretsmanager_secret.password.id
  secret_string = random_password.master.result
}

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "this" {
  name   = "${var.name}-sg"
  vpc_id = var.vpc_id
  tags   = var.tags
}

resource "aws_db_parameter_group" "this" {
  name   = var.name
  family = "postgres16"
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements,pgvector"
    apply_method = "pending-reboot"
  }
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  tags = var.tags
}

resource "aws_db_instance" "this" {
  identifier                       = var.name
  engine                           = "postgres"
  engine_version                   = var.engine_version
  instance_class                   = var.instance_class
  allocated_storage                = var.allocated_storage
  storage_encrypted                = true
  kms_key_id                       = var.kms_key_arn
  db_name                          = "auditforge"
  username                         = "auditforge"
  password                         = random_password.master.result
  multi_az                         = var.multi_az
  backup_retention_period          = var.backup_retention_days
  storage_type                     = "gp3"
  deletion_protection              = true
  skip_final_snapshot              = false
  final_snapshot_identifier        = "${var.name}-final"
  vpc_security_group_ids           = [aws_security_group.this.id]
  db_subnet_group_name             = aws_db_subnet_group.this.name
  parameter_group_name             = aws_db_parameter_group.this.name
  performance_insights_enabled     = true
  performance_insights_kms_key_id  = var.kms_key_arn
  enabled_cloudwatch_logs_exports  = ["postgresql", "upgrade"]
  copy_tags_to_snapshot            = true
  tags                             = var.tags
}
