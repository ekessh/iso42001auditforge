# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = ">= 3.100.0" }
  }
}

resource "azurerm_key_vault_key" "this" {
  name         = var.name
  key_vault_id = var.key_vault_id
  key_type     = "EC"
  curve        = "P-256"
  key_size     = 256
  key_opts     = ["sign", "verify"]
}
