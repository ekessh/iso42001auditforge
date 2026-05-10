# SPDX-License-Identifier: BUSL-1.1
output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}

output "postgres_endpoint" {
  value     = module.postgres.endpoint
  sensitive = true
}

output "postgres_secret_arn" {
  value = module.postgres.secret_arn
}

output "redis_endpoint" {
  value     = module.redis.primary_endpoint
  sensitive = true
}

output "evidence_bucket" {
  value = module.buckets.evidence_bucket
}

output "archive_bucket" {
  value = module.buckets.archive_bucket
}

output "reports_bucket" {
  value = module.buckets.reports_bucket
}

output "signing_key_arn" {
  value = module.signing_kms.key_arn
}
