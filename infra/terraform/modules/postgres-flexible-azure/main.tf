# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = ">= 3.100.0" }
    random  = { source = "hashicorp/random",  version = ">= 3.6.0" }
  }
}

resource "random_password" "master" {
  length  = 32
  special = false
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                         = var.name
  resource_group_name          = var.resource_group_name
  location                     = var.location
  version                      = "16"
  administrator_login          = "auditforge"
  administrator_password       = random_password.master.result
  sku_name                     = var.sku
  storage_mb                   = var.storage_mb
  backup_retention_days        = 35
  geo_redundant_backup_enabled = true
  tags                         = var.tags
}
