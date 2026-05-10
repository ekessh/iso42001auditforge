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
  source          = "../../modules/vpc-aws"
  name            = "${var.name_prefix}-vpc"
  cidr            = "10.0.0.0/16"
  azs             = var.azs
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
  public_subnets  = ["10.0.20.0/24", "10.0.21.0/24"]
  tags            = var.tags
}

module "eks" {
  source              = "../../modules/kubernetes-eks"
  name                = "${var.name_prefix}-eks"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  node_instance_types = ["t3.large"]
  node_min_size       = 1
  node_max_size       = 3
  node_desired_size   = 1
  tags                = var.tags
}

module "postgres" {
  source                = "../../modules/postgres-rds-pgvector"
  name                  = "${var.name_prefix}-pg"
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  instance_class        = "db.t4g.medium"
  allocated_storage     = 50
  multi_az              = false
  backup_retention_days = 7
  kms_key_arn           = module.signing_kms.key_arn
  tags                  = var.tags
}

module "redis" {
  source             = "../../modules/redis-elasticache"
  name               = "${var.name_prefix}-redis"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  node_type          = "cache.t4g.small"
  num_cache_clusters = 1
  kms_key_arn        = module.signing_kms.key_arn
  tags               = var.tags
}

module "buckets" {
  source            = "../../modules/object-storage-s3"
  name_prefix       = var.name_prefix
  kms_key_arn       = module.signing_kms.key_arn
  object_lock_years = 1
  tags              = var.tags
}
