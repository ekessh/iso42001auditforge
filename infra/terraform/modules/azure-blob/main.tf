# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = ">= 3.100.0" }
  }
}

resource "azurerm_storage_account" "this" {
  name                     = replace("${var.name_prefix}sa", "-", "")
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "GZRS"
  min_tls_version          = "TLS1_2"
  blob_properties {
    versioning_enabled = true
  }
}
