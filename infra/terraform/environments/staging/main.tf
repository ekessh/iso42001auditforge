# SPDX-License-Identifier: BUSL-1.1
provider "aws" {
  region = var.region
  default_tags {
    tags = var.tags
  }
}

module "signing_kms" {
  source = "../../modules/signing-key-aws-kms"
  name   = "${var.name_prefix}-signing"
  tags   = var.tags
}

module "vpc" {
  source               = "../../modules/vpc-aws"
  name                 = "${var.name_prefix}-vpc"
  cidr                 = "10.1.0.0/16"
  azs                  = var.azs
  private_subnets      = ["10.1.10.0/24", "10.1.11.0/24", "10.1.12.0/24"]
  public_subnets       = ["10.1.20.0/24", "10.1.21.0/24", "10.1.22.0/24"]
  flow_logs_bucket_arn = module.buckets.evidence_arn
  tags                 = var.tags
}

module "eks" {
  source              = "../../modules/kubernetes-eks"
  name                = "${var.name_prefix}-eks"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  node_instance_types = ["m6i.large"]
  node_min_size       = 2
  node_max_size       = 6
  node_desired_size   = 2
  tags                = var.tags
}

module "postgres" {
  source                = "../../modules/postgres-rds-pgvector"
  name                  = "${var.name_prefix}-pg"
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  instance_class        = "db.r6g.large"
  allocated_storage     = 100
  multi_az              = true
  backup_retention_days = 14
  kms_key_arn           = module.signing_kms.key_arn
  tags                  = var.tags
}

module "redis" {
  source             = "../../modules/redis-elasticache"
  name               = "${var.name_prefix}-redis"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  node_type          = "cache.r7g.large"
  num_cache_clusters = 2
  kms_key_arn        = module.signing_kms.key_arn
  tags               = var.tags
}

module "buckets" {
  source            = "../../modules/object-storage-s3"
  name_prefix       = var.name_prefix
  kms_key_arn       = module.signing_kms.key_arn
  object_lock_years = 3
  tags              = var.tags
}
