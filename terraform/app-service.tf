# =============================================================================
# TheCreditWhisperers - Azure App Service Configuration
# =============================================================================
# Linux Web App with Python 3.12 runtime

# =============================================================================
# App Service Plan
# =============================================================================
resource "azurerm_service_plan" "main" {
  name                = "${local.app_name}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = local.common_tags
}

# =============================================================================
# Linux Web App
# =============================================================================
resource "azurerm_linux_web_app" "main" {
  name                = local.app_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id

  # HTTPS only
  https_only = true

  site_config {
    # Always On (not available for F1/D1)
    always_on = var.app_always_on && !contains(["F1", "D1"], var.app_service_sku)

    # Python runtime
    application_stack {
      python_version = "3.12"
    }

    # Health check endpoint (uses readiness probe for dependency verification)
    health_check_path                 = "/health/ready"
    health_check_eviction_time_in_min = 5

    # CORS configuration
    cors {
      allowed_origins = [
        "http://localhost:3000",
        "https://${local.app_name}.azurewebsites.net"
      ]
      support_credentials = true
    }

    # Performance settings
    ftps_state              = "Disabled"
    minimum_tls_version     = "1.2"
    http2_enabled           = true
    websockets_enabled      = true
    vnet_route_all_enabled  = false
  }

  # Application settings (environment variables)
  app_settings = {
    # Deployment settings
    "WEBSITE_RUN_FROM_PACKAGE"       = "1"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"

    # Application settings
    "ENVIRONMENT" = var.environment
    "DEBUG"       = var.environment == "production" ? "False" : "True"

    # Frontend/API URLs
    "FRONTEND_URL"  = "https://${local.app_name}.azurewebsites.net"
    "API_BASE_URL"  = "https://${local.app_name}.azurewebsites.net"

    # Redis connection (TLS)
    "REDIS_URL" = "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}/0"

    # MongoDB connection (Cosmos DB)
    "MONGO_URI" = var.enable_cosmos_db ? azurerm_cosmosdb_account.main[0].connection_strings[0] : ""

    # Application Insights
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.main.connection_string

    # Cache TTL settings
    "PRICE_CACHE_TTL"        = "300"
    "NEWS_CACHE_TTL"         = "600"
    "SENTIMENT_CACHE_TTL"    = "900"
    "COMPANY_INFO_CACHE_TTL" = "86400"
    "SECTOR_CACHE_TTL"       = "3600"
  }

  # Managed Identity for accessing other Azure resources
  identity {
    type = "SystemAssigned"
  }

  # Logging configuration
  logs {
    detailed_error_messages = var.environment != "production"
    failed_request_tracing  = var.environment != "production"

    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }

    application_logs {
      file_system_level = "Information"
    }
  }

  tags = local.common_tags

  # Ignore changes to app_settings that are managed externally
  lifecycle {
    ignore_changes = [
      app_settings["FINNHUB_API_TOKEN"],
      app_settings["ALPHA_VANTAGE_API_KEY"],
      app_settings["NEWS_API_KEY"],
      app_settings["APPLICATION_ID"],
      app_settings["DIRECTORY_ID"],
      app_settings["CLIENT_SECRET"],
    ]
  }
}

# =============================================================================
# Staging Deployment Slot (Blue-Green Deployments)
# =============================================================================
resource "azurerm_linux_web_app_slot" "staging" {
  count          = var.enable_staging_slot ? 1 : 0
  name           = "staging"
  app_service_id = azurerm_linux_web_app.main.id

  https_only = true

  site_config {
    always_on = var.app_always_on && !contains(["F1", "D1"], var.app_service_sku)

    application_stack {
      python_version = "3.12"
    }

    health_check_path = "/health/ready"
  }

  # Same settings as production
  app_settings = azurerm_linux_web_app.main.app_settings

  identity {
    type = "SystemAssigned"
  }

  tags = merge(local.common_tags, {
    Slot = "staging"
  })
}

# =============================================================================
# Auto-Scaling Rules (Optional - for Standard/Premium tiers)
# =============================================================================
resource "azurerm_monitor_autoscale_setting" "main" {
  count               = contains(["S1", "S2", "S3", "P1v2", "P2v2", "P3v2", "P1v3", "P2v3", "P3v3"], var.app_service_sku) ? 1 : 0
  name                = "${local.app_name}-autoscale"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  target_resource_id  = azurerm_service_plan.main.id

  profile {
    name = "default"

    capacity {
      default = 1
      minimum = 1
      maximum = 5
    }

    # Scale out when CPU > 70%
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 70
      }

      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    # Scale in when CPU < 30%
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = 30
      }

      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT10M"
      }
    }
  }

  tags = local.common_tags
}
