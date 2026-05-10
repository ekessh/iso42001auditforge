# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 5.30.0" }
  }
}

resource "google_redis_instance" "this" {
  name                    = var.name
  project                 = var.project
  region                  = var.region
  tier                    = var.tier
  memory_size_gb          = var.memory_size_gb
  redis_version           = "REDIS_7_2"
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
}
