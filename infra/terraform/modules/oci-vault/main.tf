# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    oci = { source = "oracle/oci", version = ">= 5.40.0" }
  }
}

resource "oci_kms_vault" "this" {
  compartment_id = var.compartment_id
  display_name   = var.name
  vault_type     = "DEFAULT"
}
