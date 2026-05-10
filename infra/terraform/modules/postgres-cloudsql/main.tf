# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = ">= 5.30.0" }
    random = { source = "hashicorp/random", version = ">= 3.6.0" }
  }
}

resource "random_password" "root" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "this" {
  project          = var.project
  name             = var.name
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = var.tier
    availability_type = "REGIONAL"
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      retained_backups               = 30
    }
    ip_configuration {
      ipv4_enabled    = false
      private_network = "projects/${var.project}/global/networks/default"
    }
  }

  root_password       = random_password.root.result
  deletion_protection = true
}
