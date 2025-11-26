# =============================================================================
# TheCreditWhisperers - Terraform Variables
# =============================================================================
# Input variables for configuring Azure infrastructure
#
# Override defaults by creating terraform.tfvars (see terraform.tfvars.example)

# =============================================================================
# Project Configuration
# =============================================================================
variable "project_name" {
  description = "Name of the project (used in resource naming)"
  type        = string
  default     = "creditwhisperers"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "location" {
  description = "Azure region for resource deployment"
  type        = string
  default     = "japanwest"
}

# =============================================================================
# App Service Configuration
# =============================================================================
variable "app_service_sku" {
  description = "App Service Plan SKU (F1=Free, B1-B3=Basic, S1-S3=Standard, P1v3-P3v3=Premium)"
  type        = string
  default     = "B1"

  validation {
    condition = contains([
      "F1", "D1",                    # Free/Shared
      "B1", "B2", "B3",              # Basic
      "S1", "S2", "S3",              # Standard
      "P1v2", "P2v2", "P3v2",        # Premium v2
      "P1v3", "P2v3", "P3v3"         # Premium v3
    ], var.app_service_sku)
    error_message = "Invalid App Service SKU."
  }
}

variable "app_always_on" {
  description = "Keep App Service always on (not available for F1/D1 SKUs)"
  type        = bool
  default     = true
}

# =============================================================================
# Redis Cache Configuration
# =============================================================================
variable "redis_sku" {
  description = "Redis Cache SKU (Basic, Standard, Premium)"
  type        = string
  default     = "Basic"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.redis_sku)
    error_message = "Redis SKU must be one of: Basic, Standard, Premium."
  }
}

variable "redis_capacity" {
  description = "Redis Cache capacity (0-6 for Basic/Standard, 1-4 for Premium)"
  type        = number
  default     = 0

  validation {
    condition     = var.redis_capacity >= 0 && var.redis_capacity <= 6
    error_message = "Redis capacity must be between 0 and 6."
  }
}

# =============================================================================
# Cosmos DB Configuration
# =============================================================================
variable "cosmos_throughput" {
  description = "Cosmos DB throughput in RU/s (minimum 400)"
  type        = number
  default     = 400

  validation {
    condition     = var.cosmos_throughput >= 400
    error_message = "Cosmos DB throughput must be at least 400 RU/s."
  }
}

variable "cosmos_consistency_level" {
  description = "Cosmos DB consistency level"
  type        = string
  default     = "Session"

  validation {
    condition     = contains(["Eventual", "Session", "BoundedStaleness", "Strong", "ConsistentPrefix"], var.cosmos_consistency_level)
    error_message = "Invalid consistency level."
  }
}

# =============================================================================
# Monitoring Configuration
# =============================================================================
variable "log_retention_days" {
  description = "Log Analytics retention period in days"
  type        = number
  default     = 30

  validation {
    condition     = var.log_retention_days >= 7 && var.log_retention_days <= 730
    error_message = "Log retention must be between 7 and 730 days."
  }
}

# =============================================================================
# Optional Features
# =============================================================================
variable "enable_staging_slot" {
  description = "Create a staging deployment slot for blue-green deployments"
  type        = bool
  default     = true
}

variable "enable_cosmos_db" {
  description = "Deploy Azure Cosmos DB (set to false if using external MongoDB)"
  type        = bool
  default     = true
}
