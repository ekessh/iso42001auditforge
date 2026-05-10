# SPDX-License-Identifier: BUSL-1.1

output "cluster_name" {
  value = azurerm_kubernetes_cluster.this.name
}

output "kube_config" {
  value     = azurerm_kubernetes_cluster.this.kube_config_raw
  sensitive = true
}
