# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 5.30.0" }
  }
}

resource "google_kms_key_ring" "this" {
  project  = var.project
  name     = "${var.name}-ring"
  location = var.location
}

resource "google_kms_crypto_key" "this" {
  name     = var.name
  key_ring = google_kms_key_ring.this.id
  purpose  = "ASYMMETRIC_SIGN"
  version_template {
    algorithm = "EC_SIGN_ED25519"
  }
}
