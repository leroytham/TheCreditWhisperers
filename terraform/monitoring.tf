# =============================================================================
# TheCreditWhisperers - Azure Monitoring Resources
# =============================================================================
# Application Insights and Log Analytics for observability

# =============================================================================
# Log Analytics Workspace
# =============================================================================
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.app_name}-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku               = "PerGB2018"
  retention_in_days = var.log_retention_days

  # Daily cap for cost control (optional)
  daily_quota_gb = var.environment == "production" ? -1 : 1

  tags = local.common_tags
}

# =============================================================================
# Application Insights
# =============================================================================
resource "azurerm_application_insights" "main" {
  name                = "${local.app_name}-insights"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.main.id

  application_type = "web"

  # Sampling percentage (reduce for high-traffic apps)
  sampling_percentage = var.environment == "production" ? 50 : 100

  # Disable IP masking for debugging (enable in production for privacy)
  disable_ip_masking = var.environment != "production"

  tags = local.common_tags
}

# =============================================================================
# Diagnostic Settings for App Service
# =============================================================================
resource "azurerm_monitor_diagnostic_setting" "app_service" {
  name                       = "${local.app_name}-diag"
  target_resource_id         = azurerm_linux_web_app.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  # App Service HTTP logs
  enabled_log {
    category = "AppServiceHTTPLogs"
  }

  # App Service console logs
  enabled_log {
    category = "AppServiceConsoleLogs"
  }

  # App Service app logs
  enabled_log {
    category = "AppServiceAppLogs"
  }

  # Metrics
  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# =============================================================================
# Alert Rules (Optional)
# =============================================================================

# High CPU Alert
resource "azurerm_monitor_metric_alert" "high_cpu" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-high-cpu-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_service_plan.main.id]
  description         = "Alert when CPU exceeds 80%"

  criteria {
    metric_namespace = "Microsoft.Web/serverfarms"
    metric_name      = "CpuPercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 2

  tags = local.common_tags
}

# High Memory Alert
resource "azurerm_monitor_metric_alert" "high_memory" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-high-memory-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_service_plan.main.id]
  description         = "Alert when memory exceeds 80%"

  criteria {
    metric_namespace = "Microsoft.Web/serverfarms"
    metric_name      = "MemoryPercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 2

  tags = local.common_tags
}

# HTTP 5xx Errors Alert
resource "azurerm_monitor_metric_alert" "http_5xx" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-http-5xx-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when HTTP 5xx errors exceed threshold"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 10
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 1

  tags = local.common_tags
}

# Response Time Alert
resource "azurerm_monitor_metric_alert" "response_time" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-response-time-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when average response time exceeds 5 seconds"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "HttpResponseTime"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 5
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 2

  tags = local.common_tags
}

# =============================================================================
# Availability Alert (Health Check)
# =============================================================================
resource "azurerm_monitor_metric_alert" "availability" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-availability-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when health check status drops below 100%"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "HealthCheckStatus"
    aggregation      = "Average"
    operator         = "LessThan"
    threshold        = 100
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 0  # Critical

  tags = local.common_tags
}

# =============================================================================
# Request Queue Length Alert
# =============================================================================
resource "azurerm_monitor_metric_alert" "request_queue" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-request-queue-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when requests in application queue exceed threshold"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "RequestsInApplicationQueue"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 100
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 2

  tags = local.common_tags
}

# =============================================================================
# HTTP 4xx Errors Alert (Client Errors)
# =============================================================================
resource "azurerm_monitor_metric_alert" "http_4xx" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-http-4xx-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when HTTP 4xx errors exceed threshold (20% of requests)"

  dynamic_criteria {
    metric_namespace  = "Microsoft.Web/sites"
    metric_name       = "Http4xx"
    aggregation       = "Total"
    operator          = "GreaterThan"
    alert_sensitivity = "Medium"
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 2

  tags = local.common_tags
}

# =============================================================================
# Slow Requests Alert
# =============================================================================
resource "azurerm_monitor_metric_alert" "slow_requests" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-slow-requests-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when number of slow requests exceeds threshold"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "HttpResponseTime"
    aggregation      = "Count"
    operator         = "GreaterThan"
    threshold        = 50

    dimension {
      name     = "Instance"
      operator = "Include"
      values   = ["*"]
    }
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 2

  tags = local.common_tags
}

# =============================================================================
# Connection Count Alert
# =============================================================================
resource "azurerm_monitor_metric_alert" "connections" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${local.app_name}-connections-alert"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when connection count is unusually high"

  dynamic_criteria {
    metric_namespace  = "Microsoft.Web/sites"
    metric_name       = "AppConnections"
    aggregation       = "Average"
    operator          = "GreaterThan"
    alert_sensitivity = "Medium"
  }

  window_size = "PT5M"
  frequency   = "PT1M"

  severity = 2

  tags = local.common_tags
}

# =============================================================================
# Action Group for Alerts (Email Notification)
# =============================================================================
resource "azurerm_monitor_action_group" "main" {
  count               = var.environment == "production" && var.alert_email != "" ? 1 : 0
  name                = "${local.app_name}-alerts"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = "cw-alerts"

  email_receiver {
    name                    = "admin"
    email_address           = var.alert_email
    use_common_alert_schema = true
  }

  tags = local.common_tags
}
