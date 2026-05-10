# SPDX-License-Identifier: BUSL-1.1
terraform {
  backend "s3" {
    bucket         = "auditforge-tfstate-staging"
    key            = "auditforge/staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "alias/auditforge-tfstate"
    dynamodb_table = "auditforge-tfstate-locks"
  }
}
