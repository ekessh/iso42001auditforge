# SPDX-License-Identifier: BUSL-1.1
provider "aws" {
  region = var.region
  default_tags {
    tags = var.tags
  }
}

resource "aws_guardduty_detector" "this" {
  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"
  tags                         = var.tags
}

module "signing_kms" {
  source = "../../modules/signing-key-aws-kms"
  name   = "${var.name_prefix}-signing"
  tags   = var.tags
}

module "buckets" {
  source            = "../../modules/object-storage-s3"
  name_prefix       = var.name_prefix
  kms_key_arn       = module.signing_kms.key_arn
  object_lock_years = 10
  tags              = var.tags
}

module "vpc" {
  source               = "../../modules/vpc-aws"
  name                 = "${var.name_prefix}-vpc"
  cidr                 = "10.2.0.0/16"
  azs                  = var.azs
  private_subnets      = ["10.2.10.0/24", "10.2.11.0/24", "10.2.12.0/24"]
  public_subnets       = ["10.2.20.0/24", "10.2.21.0/24", "10.2.22.0/24"]
  flow_logs_bucket_arn = module.buckets.evidence_arn
  tags                 = var.tags
}

module "eks" {
  source              = "../../modules/kubernetes-eks"
  name                = "${var.name_prefix}-eks"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  node_instance_types = ["m6i.xlarge"]
  node_min_size       = 3
  node_max_size       = 30
  node_desired_size   = 6
  tags                = var.tags
}

module "postgres" {
  source                = "../../modules/postgres-rds-pgvector"
  name                  = "${var.name_prefix}-pg"
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  instance_class        = "db.r6g.2xlarge"
  allocated_storage     = 500
  multi_az              = true
  backup_retention_days = 90
  kms_key_arn           = module.signing_kms.key_arn
  tags                  = var.tags
}

module "redis" {
  source             = "../../modules/redis-elasticache"
  name               = "${var.name_prefix}-redis"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  node_type          = "cache.r7g.xlarge"
  num_cache_clusters = 3
  kms_key_arn        = module.signing_kms.key_arn
  tags               = var.tags
}
