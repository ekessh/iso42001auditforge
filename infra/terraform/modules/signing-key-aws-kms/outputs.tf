# SPDX-License-Identifier: BUSL-1.1

output "key_arn" { value = aws_kms_key.this.arn }
output "key_id"  { value = aws_kms_key.this.id }
output "alias"   { value = aws_kms_alias.this.name }
