# ArgoCD GitOps Configuration

This directory contains ArgoCD configuration for GitOps-based deployments of TheCreditWhisperers.

## Overview

ArgoCD enables declarative, Git-driven Kubernetes deployments with:
- **Automated Sync**: Cluster state automatically matches Git
- **Self-Healing**: Drift detection and automatic correction
- **Audit Trail**: Git history tracks all deployment changes
- **Easy Rollback**: Revert deployments via Git revert

## Prerequisites

1. **Kubernetes Cluster** with kubectl access
2. **ArgoCD** installed in the cluster

## ArgoCD Installation

```bash
# Create ArgoCD namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods to be ready
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

## Access ArgoCD UI

```bash
# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo

# Port-forward the ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access UI at: https://localhost:8080
# Username: admin
# Password: (from command above)
```

## Connect Repository

### Via CLI

```bash
# Install ArgoCD CLI (macOS)
brew install argocd

# Login to ArgoCD
argocd login localhost:8080

# Add repository (for private repos)
argocd repo add https://github.com/nmducc/TheCreditWhisperers.git \
  --username <github-username> \
  --password <github-pat-token>
```

### Via UI

1. Go to Settings → Repositories
2. Click "Connect Repo"
3. Enter repository URL and credentials

## Deploy Application

```bash
# Apply the ArgoCD Application
kubectl apply -f argocd/application.yaml

# Or via ArgoCD CLI
argocd app create -f argocd/application.yaml

# Check sync status
argocd app get creditwhisperers
```

## Sync Operations

```bash
# Manual sync
argocd app sync creditwhisperers

# Sync with prune (delete orphaned resources)
argocd app sync creditwhisperers --prune

# Force refresh from Git
argocd app refresh creditwhisperers

# Hard refresh (invalidate cache)
argocd app refresh creditwhisperers --hard
```

## Rollback

```bash
# List revision history
argocd app history creditwhisperers

# Rollback to specific revision
argocd app rollback creditwhisperers <revision-number>

# Or via Git (preferred)
git revert <commit-hash>
git push
# ArgoCD will auto-sync to reverted state
```

## Application Status

```bash
# Get application status
argocd app get creditwhisperers

# List all applications
argocd app list

# View application in web UI
# https://localhost:8080/applications/creditwhisperers
```

## Troubleshooting

### Application stuck in "Progressing"

```bash
# Check pod status
kubectl get pods -n creditwhisperers

# Check events
kubectl get events -n creditwhisperers --sort-by='.lastTimestamp'

# Check ArgoCD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
```

### Sync failed

```bash
# Get detailed sync status
argocd app get creditwhisperers --show-params

# Force sync with replace
argocd app sync creditwhisperers --force

# Check for validation errors
kubectl apply --dry-run=client -f k8s/
```

### Self-heal not working

```bash
# Verify sync policy
argocd app get creditwhisperers -o yaml | grep -A10 syncPolicy

# Check if automated sync is enabled
argocd app set creditwhisperers --sync-policy automated
```

## Architecture

```
Git Repository (main branch)
         │
         ▼
    ┌─────────┐
    │ ArgoCD  │ ◄── Watches for changes
    └────┬────┘
         │
         ▼ Applies manifests
    ┌─────────────────┐
    │   Kubernetes    │
    │    Cluster      │
    └─────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `application.yaml` | ArgoCD Application CR that defines sync configuration |

## Configuration Options

The `application.yaml` configures:

| Option | Value | Description |
|--------|-------|-------------|
| `targetRevision` | `main` | Git branch to sync from |
| `path` | `k8s` | Directory containing manifests |
| `automated.prune` | `true` | Delete resources not in Git |
| `automated.selfHeal` | `true` | Fix manual cluster changes |
| `retry.limit` | `5` | Number of sync retry attempts |

## Best Practices

1. **Never modify cluster directly** - Always change Git, let ArgoCD sync
2. **Use semantic versions** - Tag images with versions, not `latest`
3. **Review before merge** - Git PR review = deployment review
4. **Monitor sync status** - Set up alerts for sync failures

## Links

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [ArgoCD Best Practices](https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/)
- [GitOps Principles](https://www.gitops.tech/)
