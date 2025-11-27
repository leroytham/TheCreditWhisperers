# Frontend

React single-page application for TheCreditWhisperers portfolio sentiment analysis platform.

## Overview

The frontend provides a modern, responsive user interface for:

- Portfolio management and analytics
- Real-time stock price monitoring
- Sentiment analysis visualization
- News feed with sentiment indicators
- Price alerts and notifications

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.1 | UI framework |
| TanStack Query | 5.62 | Data fetching and caching |
| Zustand | 5.0 | State management |
| Tailwind CSS | 4.0 | Styling |
| Axios | - | HTTP client |
| Recharts | - | Charts and visualizations |
| Lucide React | - | Icons |
| Playwright | 1.49 | E2E testing |

## Prerequisites

- Node.js 20+
- npm 10+

## Installation

```bash
cd frontend
npm install
```

## Development

```bash
# Start development server
npm start
# Runs on http://localhost:3000

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build

# Analyze bundle size
npm run build -- --stats
npx webpack-bundle-analyzer build/bundle-stats.json
```

## Directory Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── errors/         # Error boundaries
│   │   └── ui/             # Base UI components
│   ├── features/           # Feature modules
│   │   ├── entity/         # Stock/ticker features
│   │   ├── sector/         # Sector analysis
│   │   ├── notifications/  # Notification system
│   │   └── shared/         # Shared components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   │   └── api.js          # Axios configuration
│   ├── store/              # Zustand state
│   │   └── useAppStore.js  # Global store
│   ├── config/             # Configuration
│   │   └── constants.js    # App constants
│   └── utils/              # Utility functions
├── e2e/                    # Playwright E2E tests
├── QUICKSTART.md           # Development best practices
└── README.md               # This file
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000

# Feature Flags
REACT_APP_ENABLE_DEVTOOLS=true
```

### Proxy Configuration

The `package.json` includes a proxy for development:

```json
{
  "proxy": "http://127.0.0.1:8000"
}
```

## Architecture

### Data Flow

```
User Action
    ↓
Component calls hook (useStockPrice)
    ↓
TanStack Query checks cache
    ↓
If cached: Return data
If not cached: Call API Service
    ↓
API Service (Axios with interceptors)
    ↓
Backend API
    ↓
Response → Cache → Component
```

### State Management

| Type | Solution | Use Case |
|------|----------|----------|
| Server State | TanStack Query | API data, caching |
| Client State | Zustand | UI state, preferences |
| URL State | React Router | Navigation, filters |

## Key Features

### Custom Hooks

```javascript
import {
  useStockPrice,      // Stock price data
  useStockSentiment,  // Sentiment analysis
  useNews,            // News articles
  useWatchlist,       // Watchlist management
  useSearch,          // Search with debouncing
} from './hooks';
```

### UI Components

```javascript
import {
  LoadingSpinner,    // Loading indicator
  ErrorMessage,      // Error display with retry
  EmptyState,        // Empty state placeholder
} from './components/ui';
```

### Store Actions

```javascript
import useAppStore from './store/useAppStore';

const {
  // Watchlist
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,

  // Notifications
  notifySuccess,
  notifyError,

  // Preferences
  theme,
  toggleTheme,
} = useAppStore();
```

## API Integration

### API Service

The API service (`services/api.js`) provides:

- Axios instance with base URL
- Request/response interceptors
- Automatic error handling
- Notification integration

```javascript
import apiService from './services/api';

// GET request
const data = await apiService.get('/api/price', { params: { ticker: 'AAPL' } });

// POST request
await apiService.post('/api/watchlist', { ticker: 'AAPL' });

// Suppress automatic notifications
await apiService.get('/api/data', { suppressNotification: true });
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### E2E Tests

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npx playwright test --ui

# Generate report
npx playwright show-report
```

### Test Configuration

Playwright configuration in `playwright.config.ts`:

| Setting | Value |
|---------|-------|
| Base URL | `http://localhost:3000` |
| Browsers | Chromium, Firefox, WebKit |
| Retries | 2 (CI), 0 (local) |
| Workers | 4 |

## Building

### Production Build

```bash
npm run build
```

Output in `build/` directory.

### Docker Build

```bash
# Build image
docker build -t creditwhisperers-frontend .

# Run container
docker run -p 3000:80 creditwhisperers-frontend
```

The Dockerfile uses:
- Node 20 for building
- Nginx for serving static files

## Nginx Configuration

Production builds are served with Nginx:

- Gzip compression enabled
- SPA routing (all routes to index.html)
- Cache headers for static assets
- Health check endpoint at `/health`

## DevTools

### React Query DevTools

Add to development:

```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

### Zustand DevTools

Already configured. Open Redux DevTools browser extension.

## Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Fix issues
npm run lint -- --fix
```

### Formatting

```bash
# Format with Prettier
npm run format
```

## Troubleshooting

### Module not found

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

### API not connecting

Check proxy configuration in `package.json` and ensure backend is running on port 8000.

### Build failures

```bash
# Clear cache
npm run build -- --no-cache

# Check for TypeScript errors
npx tsc --noEmit
```

### WebSocket not connecting

This is expected if backend is not running. The app works without WebSocket for polling-based updates.

## Related Documentation

- [QUICKSTART.md](QUICKSTART.md) - Development best practices and patterns
- [Shared Components](src/features/shared/README.md) - Shared component documentation
- [Notifications](src/features/notifications/README.md) - Notification system documentation
- [Root README](../README.md) - Project overview
- [Backend API](../backend/README.md) - API documentation
