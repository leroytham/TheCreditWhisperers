# Kubernetes Manifests

This directory contains Kubernetes manifests for deploying TheCreditWhisperers to a Kubernetes cluster.

## Overview

The platform is deployed as a set of microservices with the following components:

- Deployments for each service
- Services for internal communication
- Horizontal Pod Autoscalers (HPA) for auto-scaling
- Pod Disruption Budgets (PDB) for availability
- Network Policies for security
- ConfigMaps and Secrets for configuration
- Ingress for external access

## Namespace

All resources are deployed to the `creditwhisperers` namespace.

```bash
kubectl create namespace creditwhisperers
# Or apply namespace.yaml
kubectl apply -f k8s/namespace.yaml
```

## Manifest Files

| File | Description |
|------|-------------|
| `namespace.yaml` | Namespace definition |
| `configmap.yaml` | Non-sensitive configuration |
| `secret.yaml` | Sensitive configuration (API keys, etc.) |
| `deployment.yaml` | Backend API deployment |
| `service.yaml` | Backend ClusterIP service |
| `hpa.yaml` | Backend HPA configuration |
| `pdb.yaml` | Pod Disruption Budget |
| `network-policy.yaml` | Network segmentation rules |
| `ingress.yaml` | Ingress configuration |
| `prometheus-rules.yaml` | Prometheus alerting rules |

### Frontend

| File | Description |
|------|-------------|
| `frontend-deployment.yaml` | Frontend deployment |
| `frontend-service.yaml` | Frontend ClusterIP service |
| `frontend-hpa.yaml` | Frontend HPA |

### Microservices

| Service | Deployment | HPA |
|---------|------------|-----|
| Market Data | `market-data-deployment.yaml` | `market-data-hpa.yaml` |
| Sentiment | `sentiment-deployment.yaml` | `sentiment-hpa.yaml` |
| Notification | `notification-deployment.yaml` | `notification-hpa.yaml` |
| Portfolio | `portfolio-deployment.yaml` | `portfolio-hpa.yaml` |

## Deployment

### Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- Container images pushed to registry

### Deploy All Resources

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or apply in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n creditwhisperers

# Check services
kubectl get svc -n creditwhisperers

# Check HPA status
kubectl get hpa -n creditwhisperers

# Check pod logs
kubectl logs -n creditwhisperers -l app=backend -f
```

## Configuration

### ConfigMap

Non-sensitive configuration in `configmap.yaml`:

| Key | Description |
|-----|-------------|
| `ENVIRONMENT` | Environment name |
| `DEBUG` | Debug mode |
| `REDIS_HOST` | Redis hostname |
| `MONGO_DB_NAME` | MongoDB database name |

### Secrets

Sensitive configuration in `secret.yaml`:

| Key | Description |
|-----|-------------|
| `MONGO_URI` | MongoDB connection string |
| `REDIS_PASSWORD` | Redis password |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key |
| `FINNHUB_API_TOKEN` | Finnhub API token |
| `NEWS_API_KEY` | NewsAPI key |
| `SENTRY_DSN` | Sentry DSN |

Create secrets:

```bash
kubectl create secret generic creditwhisperers-secrets \
  --from-literal=MONGO_URI='mongodb://...' \
  --from-literal=ALPHA_VANTAGE_API_KEY='your-key' \
  -n creditwhisperers
```

## Scaling

### Horizontal Pod Autoscaler

Each service has an HPA configured:

| Service | Min Replicas | Max Replicas | Target CPU |
|---------|-------------|--------------|------------|
| Backend | 2 | 10 | 70% |
| Frontend | 2 | 5 | 80% |
| Market Data | 2 | 5 | 70% |
| Sentiment | 2 | 5 | 70% |
| Notification | 2 | 5 | 70% |
| Portfolio | 2 | 5 | 70% |

Manual scaling:

```bash
kubectl scale deployment backend -n creditwhisperers --replicas=3
```

### Pod Disruption Budget

PDBs ensure availability during maintenance:

```yaml
minAvailable: 1  # At least 1 pod always running
```

## Health Probes

All deployments include:

| Probe | Path | Initial Delay | Period |
|-------|------|---------------|--------|
| Liveness | `/health/live` | 30s | 10s |
| Readiness | `/health/ready` | 10s | 5s |
| Startup | `/health/startup` | 10s | 5s |

## Network Policies

Network policies in `network-policy.yaml` restrict traffic:

- Frontend can only access Backend
- Backend can access all microservices
- Microservices can access MongoDB and Redis
- All services can be accessed by Prometheus

## Topology Spread

Deployments use topology spread constraints for high availability:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway
```

## Resource Limits

Default resource configuration:

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 100m | 500m |
| Memory | 256Mi | 512Mi |

ML services (Sentiment) have higher limits:

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 500m | 2000m |
| Memory | 1Gi | 2Gi |

## Rolling Updates

Deployments use rolling update strategy:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

## Troubleshooting

### Pods not starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n creditwhisperers

# Check logs
kubectl logs <pod-name> -n creditwhisperers --previous
```

### Service not accessible

```bash
# Check endpoints
kubectl get endpoints -n creditwhisperers

# Check service
kubectl describe svc backend -n creditwhisperers
```

### HPA not scaling

```bash
# Check HPA status
kubectl describe hpa backend -n creditwhisperers

# Check metrics server
kubectl top pods -n creditwhisperers
```

## Related Documentation

- [Root README](../README.md)
- [ArgoCD Deployment](../argocd/README.md)
- [Terraform Infrastructure](../terraform/README.md)
