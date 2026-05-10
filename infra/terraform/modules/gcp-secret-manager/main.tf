# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 5.30.0" }
  }
}

resource "google_secret_manager_secret" "this" {
  project   = var.project
  secret_id = var.name
  replication {
    auto {}
  }
}
