# Microservices

This directory contains the dedicated microservices for TheCreditWhisperers platform.

## Overview

The platform follows a microservices architecture where each service has a specific responsibility:

```
                          ┌─────────────────────┐
                          │   Frontend/Backend  │
                          │   (API Gateway)     │
                          └──────────┬──────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Market Data    │       │   Sentiment     │       │  Notification   │
│    Service      │       │    Service      │       │    Service      │
│   Port: 8002    │       │   Port: 8003    │       │   Port: 8001    │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         ▼                         │
         │                ┌─────────────────┐                │
         └───────────────►│   Portfolio     │◄───────────────┘
                          │    Service      │
                          │   Port: 8004    │
                          └─────────────────┘
```

## Services

| Service | Port | Description | Dependencies |
|---------|------|-------------|--------------|
| [Market Data Service](market-data-service/README.md) | 8002 | Stock prices, company info, historical data | Redis |
| [Sentiment Service](sentiment-service/README.md) | 8003 | News aggregation and sentiment analysis | Redis |
| [Notification Service](notification-service/README.md) | 8001 | Real-time alerts and WebSocket | MongoDB, Redis |
| [Portfolio Service](portfolio-service/README.md) | 8004 | Portfolio aggregation and analytics | Market Data, Sentiment, Redis |

## Service Communication

### Synchronous (HTTP/REST)

Services communicate via HTTP REST calls for request-response operations:

- Portfolio Service calls Market Data Service for stock quotes
- Portfolio Service calls Sentiment Service for sentiment scores
- Backend calls all services for aggregated responses

### Asynchronous (Redis Pub/Sub)

Redis Pub/Sub is used for event-driven communication:

- Price alerts trigger notifications
- News updates broadcast to interested clients
- Portfolio updates propagate to WebSocket connections

## Shared Components

Each service uses similar patterns and shared configurations:

### Circuit Breaker

All external API calls are protected by circuit breakers to prevent cascade failures. See [backend/README.md](../backend/README.md#circuit-breakers) for configuration details.

### Redis Caching

Services cache responses in Redis with configurable TTLs. See [backend/README.md](../backend/README.md#cache-ttl-settings) for TTL configuration.

### Health Checks

All services expose standard health endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Basic health check |
| `/health/live` | Kubernetes liveness probe |
| `/health/ready` | Kubernetes readiness probe |
| `/health/startup` | Kubernetes startup probe |

## Running Services

### With Docker Compose

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up market-data-service -d

# View logs
docker-compose logs -f market-data-service
```

### Individually

```bash
# Market Data Service
cd services/market-data-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload

# Sentiment Service
cd services/sentiment-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload

# Notification Service
cd services/notification-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Portfolio Service
cd services/portfolio-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
```

## Environment Variables

Common environment variables across services:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable debug mode | `false` |
| `ENVIRONMENT` | Environment name | `development` |
| `HOST` | Service host | `0.0.0.0` |
| `PORT` | Service port | Service-specific |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |

See individual service READMEs for service-specific variables.

## Directory Structure

```
services/
├── market-data-service/
│   ├── app/
│   │   ├── core/           # Configuration, caching, circuit breaker
│   │   ├── services/       # Stock data service
│   │   └── main.py         # FastAPI application
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
├── sentiment-service/
│   ├── app/
│   │   ├── core/           # Configuration, caching, circuit breaker
│   │   ├── services/       # News and sentiment services
│   │   └── main.py         # FastAPI application
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
├── notification-service/
│   ├── app/
│   │   ├── core/           # Configuration, database
│   │   ├── models/         # Notification models
│   │   └── main.py         # FastAPI application
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
├── portfolio-service/
│   ├── app/
│   │   ├── core/           # Configuration, caching
│   │   ├── models/         # Portfolio models
│   │   ├── services/       # Portfolio services
│   │   └── main.py         # FastAPI application
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
└── README.md               # This file
```

## Related Documentation

- [Root README](../README.md)
- [Backend API](../backend/README.md)
- [Kubernetes Deployment](../k8s/README.md)
