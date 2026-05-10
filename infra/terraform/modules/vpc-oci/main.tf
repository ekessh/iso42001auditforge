# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    oci = { source = "oracle/oci", version = ">= 5.40.0" }
  }
}

resource "oci_core_vcn" "this" {
  compartment_id = var.compartment_id
  display_name   = var.name
  cidr_blocks    = var.cidr_blocks
  dns_label      = "auditforge"
}
