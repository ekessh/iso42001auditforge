# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    oci = { source = "oracle/oci", version = ">= 5.40.0" }
  }
}

resource "oci_kms_key" "this" {
  compartment_id      = var.compartment_id
  management_endpoint = var.management_endpoint
  display_name        = var.name
  key_shape {
    algorithm = "ECDSA"
    length    = 32
    curve_id  = "NIST_P256"
  }
}
