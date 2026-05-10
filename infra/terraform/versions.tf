# SPDX-License-Identifier: BUSL-1.1
terraform {
  required_version = ">= 1.6.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.50.0, < 6.0.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.100.0, < 4.0.0"
    }
    google = {
      source  = "hashicorp/google"
      version = ">= 5.30.0, < 6.0.0"
    }
    oci = {
      source  = "oracle/oci"
      version = ">= 5.40.0, < 6.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0"
    }
  }
}
