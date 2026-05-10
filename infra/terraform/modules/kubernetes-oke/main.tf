# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    oci = { source = "oracle/oci", version = ">= 5.40.0" }
  }
}

resource "oci_containerengine_cluster" "this" {
  compartment_id     = var.compartment_id
  kubernetes_version = var.kubernetes_version
  name               = var.name
  vcn_id             = var.vcn_id
}
