# Terraform Infrastructure

This directory contains Terraform configurations for provisioning Azure infrastructure for TheCreditWhisperers.

## Overview

The Terraform configuration provisions:

- Azure App Service for hosting
- Azure Cosmos DB (MongoDB API) for database
- Azure Cache for Redis
- Azure Monitor for observability
- Supporting resources (Resource Group, Key Vault, etc.)

## Prerequisites

- Terraform 1.0+
- Azure CLI installed and authenticated
- Azure subscription with appropriate permissions

## Files

| File | Description |
|------|-------------|
| `main.tf` | Main configuration (provider, resource group, etc.) |
| `variables.tf` | Input variable definitions |
| `outputs.tf` | Output value definitions |
| `app-service.tf` | Azure App Service configuration |
| `cosmosdb.tf` | Azure Cosmos DB (MongoDB) configuration |
| `redis.tf` | Azure Cache for Redis configuration |
| `monitoring.tf` | Azure Monitor and Log Analytics |

## Configuration

### Variables

Create a `terraform.tfvars` file:

```hcl
# Required
resource_group_name = "creditwhisperers-rg"
location            = "eastus"
environment         = "production"

# App Service
app_service_plan_sku = "P1v3"

# Cosmos DB
cosmosdb_throughput = 400

# Redis
redis_sku_name   = "Standard"
redis_family     = "C"
redis_capacity   = 1

# Monitoring
log_retention_days = 30
```

### Backend Configuration

For team collaboration, configure remote state:

```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfstate12345"
    container_name       = "tfstate"
    key                  = "creditwhisperers.tfstate"
  }
}
```

## Usage

### Initialize

```bash
cd terraform

# Initialize Terraform
terraform init

# Initialize with backend
terraform init -backend-config="storage_account_name=your_storage"
```

### Plan

```bash
# Review changes
terraform plan

# Save plan to file
terraform plan -out=tfplan
```

### Apply

```bash
# Apply changes
terraform apply

# Apply saved plan
terraform apply tfplan

# Auto-approve (for CI/CD)
terraform apply -auto-approve
```

### Destroy

```bash
# Destroy all resources
terraform destroy

# Target specific resource
terraform destroy -target=azurerm_app_service.backend
```

## Resources Created

### Resource Group

All resources are created in a single resource group.

### App Service

| Resource | Description |
|----------|-------------|
| App Service Plan | Hosting plan for web apps |
| App Service (Backend) | FastAPI backend application |
| App Service (Frontend) | React frontend application |

### Cosmos DB

| Resource | Description |
|----------|-------------|
| Cosmos DB Account | MongoDB-compatible database |
| Database | `creditwhisperers` database |
| Collections | Portfolios, notifications, etc. |

### Redis

| Resource | Description |
|----------|-------------|
| Redis Cache | Caching and Pub/Sub |

### Monitoring

| Resource | Description |
|----------|-------------|
| Log Analytics Workspace | Centralized logging |
| Application Insights | Application performance monitoring |
| Diagnostic Settings | Log collection configuration |

## Outputs

After applying, the following outputs are available:

| Output | Description |
|--------|-------------|
| `resource_group_name` | Created resource group name |
| `app_service_url` | Backend App Service URL |
| `frontend_url` | Frontend App Service URL |
| `cosmosdb_connection_string` | MongoDB connection string |
| `redis_connection_string` | Redis connection string |
| `application_insights_key` | App Insights instrumentation key |

View outputs:

```bash
terraform output

# Get specific output
terraform output -raw cosmosdb_connection_string
```

## State Management

### Remote State

Store state remotely for team collaboration:

```bash
# Create storage account for state
az storage account create \
  --name tfstate12345 \
  --resource-group terraform-state-rg \
  --sku Standard_LRS

# Create container
az storage container create \
  --name tfstate \
  --account-name tfstate12345
```

### State Commands

```bash
# List resources in state
terraform state list

# Show resource details
terraform state show azurerm_app_service.backend

# Move resource
terraform state mv <source> <destination>

# Remove from state (without destroying)
terraform state rm <resource>
```

## Environment Separation

Use workspaces or separate directories:

```bash
# Using workspaces
terraform workspace new staging
terraform workspace new production
terraform workspace select production

# Or separate tfvars files
terraform plan -var-file="production.tfvars"
terraform plan -var-file="staging.tfvars"
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Terraform Init
  run: terraform init

- name: Terraform Plan
  run: terraform plan -no-color
  env:
    ARM_CLIENT_ID: ${{ secrets.ARM_CLIENT_ID }}
    ARM_CLIENT_SECRET: ${{ secrets.ARM_CLIENT_SECRET }}
    ARM_SUBSCRIPTION_ID: ${{ secrets.ARM_SUBSCRIPTION_ID }}
    ARM_TENANT_ID: ${{ secrets.ARM_TENANT_ID }}
```

## Cost Estimation

Use `terraform plan` with cost estimation:

```bash
# Install Infracost
brew install infracost

# Estimate costs
infracost breakdown --path .
```

## Troubleshooting

### Authentication Errors

```bash
# Re-authenticate Azure CLI
az login

# Check current subscription
az account show

# Set subscription
az account set --subscription "your-subscription-id"
```

### State Lock Issues

```bash
# Force unlock (use carefully)
terraform force-unlock <lock-id>
```

### Provider Errors

```bash
# Upgrade providers
terraform init -upgrade
```

## Related Documentation

- [Root README](../README.md)
- [Kubernetes Deployment](../k8s/README.md)
- [Monitoring](../monitoring/README.md)
