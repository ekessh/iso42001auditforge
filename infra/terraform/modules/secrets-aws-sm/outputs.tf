# SPDX-License-Identifier: BUSL-1.1

output "secret_arn" { value = aws_secretsmanager_secret.this.arn }
