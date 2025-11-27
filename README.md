# TheCreditWhisperers

A cloud-native financial portfolio sentiment analysis platform that aggregates market data, financial news, and sentiment analysis to provide real-time portfolio insights and alerts to investors.

## Overview

TheCreditWhisperers is built as a microservices architecture, combining a React frontend with a FastAPI backend and specialized microservices for market data, sentiment analysis, notifications, and portfolio management.

## Architecture

```
                                    ┌─────────────────┐
                                    │   Frontend      │
                                    │   (React 19)    │
                                    │   Port: 3000    │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   Nginx Proxy   │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
           ┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
           │  Backend API    │     │  Market Data    │     │   Sentiment     │
           │  (FastAPI)      │     │    Service      │     │    Service      │
           │  Port: 8000     │     │  Port: 8002     │     │  Port: 8003     │
           └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                    │                        │                        │
                    │              ┌────────▼────────┐                │
                    │              │  Notification   │                │
                    │              │    Service      │                │
                    │              │  Port: 8001     │                │
                    │              └────────┬────────┘                │
                    │                        │                        │
           ┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
           │                 │     │                 │     │   Portfolio     │
           │    MongoDB      │◄────┤     Redis       ├────►│    Service      │
           │                 │     │   (Cache/PubSub)│     │  Port: 8004     │
           └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React | 19.1 |
| | TanStack Query | 5.62 |
| | Zustand | 5.0 |
| | Tailwind CSS | 4.0 |
| **Backend** | FastAPI | 0.121 |
| | Python | 3.12 |
| | Uvicorn | 0.38 |
| **ML/NLP** | Sentence Transformers | 5.1 |
| | HuggingFace Transformers | 4.57 |
| **Database** | MongoDB | 7.0 |
| **Cache** | Redis | 7.x |
| **Infrastructure** | Kubernetes | - |
| | ArgoCD | - |
| | Terraform | 1.0+ |
| **Observability** | Prometheus | - |
| | Grafana | - |
| | Sentry | 2.19 |
| | OpenTelemetry | 1.28 |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend development)

### Running with Docker Compose

```bash
# Clone the repository
git clone https://github.com/nmducc/TheCreditWhisperers.git
cd TheCreditWhisperers

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Local Development

**Frontend:**
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# Runs on http://localhost:8000
```

## Directory Structure

```
TheCreditWhisperers/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── features/          # Feature modules
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client
│   │   └── store/             # Zustand state management
│   └── README.md
├── backend/                   # FastAPI monolithic backend
│   ├── app/
│   │   ├── api/               # API routes
│   │   ├── models/            # Database models
│   │   └── services/          # Business logic
│   └── README.md
├── services/                  # Microservices
│   ├── market-data-service/   # Stock prices, company info
│   ├── sentiment-service/     # News and sentiment analysis
│   ├── notification-service/  # Real-time alerts
│   ├── portfolio-service/     # Portfolio aggregation
│   └── README.md
├── k8s/                       # Kubernetes manifests
│   └── README.md
├── terraform/                 # Azure infrastructure
│   └── README.md
├── monitoring/                # Prometheus & Grafana
│   └── README.md
├── argocd/                    # GitOps configuration
│   └── README.md
├── tests/
│   └── load/                  # k6 load tests
│       └── README.md
├── docker-compose.yml         # Local development
├── docker-compose.dev.yml     # Development overrides
└── docker-compose.monitoring.yml  # Monitoring stack
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React SPA with Nginx |
| Backend API | 8000 | Main FastAPI application |
| Notification Service | 8001 | WebSocket and alerts |
| Market Data Service | 8002 | Stock prices and quotes |
| Sentiment Service | 8003 | News and sentiment analysis |
| Portfolio Service | 8004 | Portfolio aggregation |
| MongoDB | 27017 | Document database |
| Redis | 6379 | Cache and Pub/Sub |

## External APIs

The platform integrates with the following external APIs:

| API | Purpose |
|-----|---------|
| Alpha Vantage | Stock prices, earnings data |
| Yahoo Finance | Stock quotes, company info |
| Finnhub | Financial news |
| NewsAPI | News articles |
| MarketAux | Market news |
| Reuters RSS | News feeds |

## Environment Variables

Key environment variables (see [backend/README.md](backend/README.md#environment-variables) for complete list):

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key |
| `FINNHUB_API_TOKEN` | Finnhub API token |
| `NEWS_API_KEY` | NewsAPI key |
| `SENTRY_DSN` | Sentry error tracking DSN |

## Documentation

| Component | Documentation |
|-----------|---------------|
| Frontend | [frontend/README.md](frontend/README.md) |
| Backend | [backend/README.md](backend/README.md) |
| Microservices | [services/README.md](services/README.md) |
| Kubernetes | [k8s/README.md](k8s/README.md) |
| Terraform | [terraform/README.md](terraform/README.md) |
| Monitoring | [monitoring/README.md](monitoring/README.md) |
| ArgoCD | [argocd/README.md](argocd/README.md) |
| Load Testing | [tests/load/README.md](tests/load/README.md) |

## CI/CD

The project uses GitHub Actions for continuous integration and deployment:

- **PR Validation**: Code quality checks, linting, secret scanning
- **Build & Deploy**: Docker image builds, E2E tests, load tests
- **Scheduled Tests**: Nightly soak tests, weekly spike tests

Deployments are managed via ArgoCD with GitOps principles.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- **Python**: Black formatter, isort imports, flake8 linting
- **JavaScript**: ESLint, Prettier
- **Pre-commit hooks**: Run `pre-commit install` after cloning

## License

This project is proprietary software. All rights reserved.

## Support

For issues or questions, please open a GitHub issue or contact the development team.
