# SPDX-License-Identifier: BUSL-1.1

terraform {
  required_providers {
    oci = { source = "oracle/oci", version = ">= 5.40.0" }
  }
}

resource "oci_objectstorage_bucket" "evidence" {
  compartment_id = var.compartment_id
  name           = "${var.name_prefix}-evidence"
  namespace      = var.namespace
  versioning     = "Enabled"
}
