# =============================================================================
# TheCreditWhisperers - Azure Cosmos DB (MongoDB API)
# =============================================================================
# Managed MongoDB-compatible database for application data

# =============================================================================
# Cosmos DB Account
# =============================================================================
resource "azurerm_cosmosdb_account" "main" {
  count               = var.enable_cosmos_db ? 1 : 0
  name                = local.cosmos_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # MongoDB API
  offer_type = "Standard"
  kind       = "MongoDB"

  # Enable MongoDB capabilities
  capabilities {
    name = "EnableMongo"
  }

  capabilities {
    name = "MongoDBv3.4"
  }

  # Enable serverless for cost optimization (optional)
  # capabilities {
  #   name = "EnableServerless"
  # }

  # Consistency policy
  consistency_policy {
    consistency_level       = var.cosmos_consistency_level
    max_interval_in_seconds = 5
    max_staleness_prefix    = 100
  }

  # Primary region
  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }

  # Backup policy
  backup {
    type                = "Periodic"
    interval_in_minutes = 240
    retention_in_hours  = 8
    storage_redundancy  = "Local"
  }

  # Security settings
  public_network_access_enabled     = true
  is_virtual_network_filter_enabled = false

  tags = local.common_tags
}

# =============================================================================
# MongoDB Database
# =============================================================================
resource "azurerm_cosmosdb_mongo_database" "main" {
  count               = var.enable_cosmos_db ? 1 : 0
  name                = "creditwhisperers"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main[0].name

  # Provisioned throughput (RU/s)
  throughput = var.cosmos_throughput
}

# =============================================================================
# MongoDB Collections
# =============================================================================

# Users collection
resource "azurerm_cosmosdb_mongo_collection" "users" {
  count               = var.enable_cosmos_db ? 1 : 0
  name                = "users"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main[0].name
  database_name       = azurerm_cosmosdb_mongo_database.main[0].name

  shard_key = "username"

  index {
    keys   = ["username"]
    unique = true
  }

  index {
    keys = ["_id"]
  }
}

# Portfolios collection
resource "azurerm_cosmosdb_mongo_collection" "portfolios" {
  count               = var.enable_cosmos_db ? 1 : 0
  name                = "portfolios"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main[0].name
  database_name       = azurerm_cosmosdb_mongo_database.main[0].name

  shard_key = "username"

  index {
    keys = ["username", "account_name"]
  }

  index {
    keys = ["_id"]
  }
}

# Notifications collection
resource "azurerm_cosmosdb_mongo_collection" "notifications" {
  count               = var.enable_cosmos_db ? 1 : 0
  name                = "notifications"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main[0].name
  database_name       = azurerm_cosmosdb_mongo_database.main[0].name

  shard_key = "user"

  index {
    keys = ["user", "read", "archived"]
  }

  index {
    keys = ["user", "created_at"]
  }

  index {
    keys = ["_id"]
  }

  # TTL for auto-expiring old notifications (30 days)
  default_ttl_seconds = 2592000
}
