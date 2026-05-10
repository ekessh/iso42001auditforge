# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = ">= 3.100.0" }
  }
}

resource "azurerm_virtual_network" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = var.address_space
  tags                = var.tags
}

resource "azurerm_subnet" "this" {
  count                = length(var.subnet_prefixes)
  name                 = "${var.name}-sn-${count.index}"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.subnet_prefixes[count.index]]
}
