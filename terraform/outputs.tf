# =============================================================================
# TheCreditWhisperers - Terraform Outputs
# =============================================================================
# Output values for use in CI/CD pipelines and other automation

# =============================================================================
# Resource Group
# =============================================================================
output "resource_group_name" {
  description = "Name of the Azure Resource Group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_location" {
  description = "Location of the Azure Resource Group"
  value       = azurerm_resource_group.main.location
}

# =============================================================================
# App Service
# =============================================================================
output "app_service_name" {
  description = "Name of the Azure App Service"
  value       = azurerm_linux_web_app.main.name
}

output "app_service_url" {
  description = "URL of the production App Service"
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "app_service_staging_url" {
  description = "URL of the staging deployment slot"
  value       = var.enable_staging_slot ? "https://${azurerm_linux_web_app_slot.staging[0].default_hostname}" : null
}

output "app_service_principal_id" {
  description = "Managed Identity Principal ID for the App Service"
  value       = azurerm_linux_web_app.main.identity[0].principal_id
}

# =============================================================================
# Redis Cache
# =============================================================================
output "redis_hostname" {
  description = "Redis Cache hostname"
  value       = azurerm_redis_cache.main.hostname
  sensitive   = true
}

output "redis_ssl_port" {
  description = "Redis Cache SSL port"
  value       = azurerm_redis_cache.main.ssl_port
}

output "redis_connection_string" {
  description = "Redis connection string (SSL)"
  value       = "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}/0"
  sensitive   = true
}

# =============================================================================
# Cosmos DB
# =============================================================================
output "cosmos_endpoint" {
  description = "Cosmos DB account endpoint"
  value       = var.enable_cosmos_db ? azurerm_cosmosdb_account.main[0].endpoint : null
}

output "cosmos_connection_string" {
  description = "Cosmos DB MongoDB connection string"
  value       = var.enable_cosmos_db ? azurerm_cosmosdb_account.main[0].connection_strings[0] : null
  sensitive   = true
}

# =============================================================================
# Monitoring
# =============================================================================
output "application_insights_connection_string" {
  description = "Application Insights connection string"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

output "application_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "log_analytics_workspace_id" {
  description = "Log Analytics Workspace ID"
  value       = azurerm_log_analytics_workspace.main.id
}

# =============================================================================
# Summary Output
# =============================================================================
output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    environment        = var.environment
    region             = var.location
    app_url            = "https://${azurerm_linux_web_app.main.default_hostname}"
    app_service_plan   = var.app_service_sku
    redis_sku          = var.redis_sku
    cosmos_enabled     = var.enable_cosmos_db
    staging_slot       = var.enable_staging_slot
  }
}
