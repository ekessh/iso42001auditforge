# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = ">= 3.100.0" }
  }
}

resource "azurerm_redis_cache" "this" {
  name                 = var.name
  resource_group_name  = var.resource_group_name
  location             = var.location
  capacity             = var.capacity
  family               = "P"
  sku_name             = var.sku_name
  non_ssl_port_enabled = false
  minimum_tls_version  = "1.2"
}
