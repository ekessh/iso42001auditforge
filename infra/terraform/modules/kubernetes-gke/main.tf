# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 5.30.0" }
  }
}

resource "google_container_cluster" "this" {
  name                     = var.name
  project                  = var.project
  location                 = var.region
  network                  = var.network
  subnetwork               = var.subnetwork
  remove_default_node_pool = true
  initial_node_count       = 1
  release_channel {
    channel = "STABLE"
  }
  workload_identity_config {
    workload_pool = "${var.project}.svc.id.goog"
  }
}

resource "google_container_node_pool" "this" {
  name       = "${var.name}-np"
  project    = var.project
  location   = var.region
  cluster    = google_container_cluster.this.name
  node_count = var.node_count
  node_config {
    machine_type = var.machine_type
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
