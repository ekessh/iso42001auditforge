# SPDX-License-Identifier: BUSL-1.1

output "primary_endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
output "port"             { value = aws_elasticache_replication_group.this.port }
