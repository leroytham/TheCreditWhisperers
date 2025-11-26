# =============================================================================
# TheCreditWhisperers - Azure Cache for Redis
# =============================================================================
# Managed Redis cache for application caching (L2 cache layer)

resource "azurerm_redis_cache" "main" {
  name                = local.redis_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # SKU configuration
  capacity = var.redis_capacity
  family   = var.redis_sku == "Premium" ? "P" : "C"
  sku_name = var.redis_sku

  # Security settings
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"

  # Redis configuration
  redis_configuration {
    # Eviction policy for cache management
    maxmemory_policy = "allkeys-lru"

    # Enable AOF persistence for Premium tier
    aof_backup_enabled = var.redis_sku == "Premium" ? true : false

    # Enable RDB backup for Standard/Premium tier
    rdb_backup_enabled = var.redis_sku != "Basic" ? true : false
  }

  # Public network access (set to false for VNet integration)
  public_network_access_enabled = true

  tags = local.common_tags
}

# =============================================================================
# Redis Firewall Rules (Optional - restrict access)
# =============================================================================
# Uncomment to restrict Redis access to specific IP ranges
#
# resource "azurerm_redis_firewall_rule" "allow_azure" {
#   name                = "AllowAzureServices"
#   redis_cache_name    = azurerm_redis_cache.main.name
#   resource_group_name = azurerm_resource_group.main.name
#   start_ip            = "0.0.0.0"
#   end_ip              = "0.0.0.0"  # Azure services
# }
