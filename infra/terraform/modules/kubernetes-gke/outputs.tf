# SPDX-License-Identifier: BUSL-1.1

output "cluster_name"     { value = google_container_cluster.this.name }
output "cluster_endpoint" { value = google_container_cluster.this.endpoint }
