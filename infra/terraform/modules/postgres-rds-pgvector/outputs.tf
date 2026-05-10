# SPDX-License-Identifier: BUSL-1.1

output "endpoint"   { value = aws_db_instance.this.endpoint }
output "address"    { value = aws_db_instance.this.address }
output "port"       { value = aws_db_instance.this.port }
output "db_name"    { value = aws_db_instance.this.db_name }
output "secret_arn" { value = aws_secretsmanager_secret.password.arn }
