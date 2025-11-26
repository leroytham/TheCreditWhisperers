# =============================================================================
# TheCreditWhisperers - Terraform Main Configuration
# =============================================================================
# Infrastructure as Code for Azure resources
#
# Usage:
#   terraform init
#   terraform plan -var-file="terraform.tfvars"
#   terraform apply -var-file="terraform.tfvars"

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  # ==========================================================================
  # Remote State Storage (Recommended for Teams)
  # ==========================================================================
  # Uncomment and configure for shared state management
  #
  # backend "azurerm" {
  #   resource_group_name  = "tfstate-rg"
  #   storage_account_name = "creditwhispererstfstate"
  #   container_name       = "tfstate"
  #   key                  = "creditwhisperers.tfstate"
  # }
}

# Azure Provider Configuration
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }

    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# =============================================================================
# Resource Group
# =============================================================================
resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-${var.environment}-rg"
  location = var.location

  tags = local.common_tags
}

# =============================================================================
# Local Variables
# =============================================================================
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = "TheCreditWhisperers"
  }

  # Computed names
  app_name    = "${var.project_name}-${var.environment}"
  redis_name  = "${var.project_name}-${var.environment}-redis"
  cosmos_name = "${var.project_name}-${var.environment}-cosmos"
}
