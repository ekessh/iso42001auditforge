# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 5.30.0" }
  }
}

resource "google_storage_bucket" "evidence" {
  name                        = "${var.name_prefix}-evidence"
  project                     = var.project
  location                    = var.location
  uniform_bucket_level_access = true
  versioning {
    enabled = true
  }
  retention_policy {
    is_locked        = true
    retention_period = 315360000
  }
}
