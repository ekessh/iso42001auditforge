# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 5.30.0" }
  }
}

resource "google_compute_network" "this" {
  name                    = var.name
  project                 = var.project
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "this" {
  name                     = "${var.name}-sn"
  project                  = var.project
  region                   = var.region
  network                  = google_compute_network.this.id
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true
}
