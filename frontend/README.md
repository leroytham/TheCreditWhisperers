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
└── README.md               # This file
```

## Quick Examples

### 1. Fetching Stock Data

**Before (Bad):**
```javascript
function StockCard({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/price?ticker=${ticker}`)
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error!</div>;

  return <div>{data?.price}</div>;
}
```

**After (Good):**
```javascript
import { useStockPrice } from './hooks';
import { LoadingSpinner, ErrorMessage } from './components/ui';

function StockCard({ ticker }) {
  const { data, isLoading, error, refetch } = useStockPrice(ticker, '1Y');

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;

  return <div>${data.price}</div>;
}
```

**Benefits:**
- Automatic caching
- Background refetching
- Request deduplication
- Error handling
- Retry logic
- No boilerplate

### 2. Managing Global State

**Before (Bad):**
```javascript
// Prop drilling hell
<App>
  <Sidebar watchlist={watchlist} setWatchlist={setWatchlist}>
    <WatchlistItem
      watchlist={watchlist}
      setWatchlist={setWatchlist}
      ticker="AAPL"
    />
  </Sidebar>
</App>
```

**After (Good):**
```javascript
import useAppStore from './store/useAppStore';

function WatchlistItem({ ticker }) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useAppStore();

  return (
    <button
      onClick={() =>
        isInWatchlist(ticker)
          ? removeFromWatchlist(ticker)
          : addToWatchlist(ticker)
      }
    >
      {isInWatchlist(ticker) ? '⭐' : '☆'}
    </button>
  );
}
```

### 3. Search with Debouncing

**Before (Bad):**
```javascript
function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    // No debouncing - API called on every keystroke!
    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(setResults);
  }, [query]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

**After (Good):**
```javascript
import { useSearch } from './hooks';

function SearchBar() {
  const { searchQuery, setSearchQuery, results, isSearching } = useSearch();

  return (
    <div>
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search tickers..."
      />
      {isSearching && <LoadingSpinner size="sm" />}
      <SearchResults results={results} />
    </div>
  );
}
```

**Benefits:**
- Automatic debouncing (300ms)
- Caching of results
- Loading states
- Recent searches stored

### 4. Error Handling

**Before (Bad):**
```javascript
function App() {
  return <Dashboard />; // Crashes entire app on error
}
```

**After (Good):**
```javascript
import ErrorBoundary from './components/errors/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
```

**Benefits:**
- Catches React errors
- Prevents app crashes
- Shows user-friendly error UI
- Retry functionality
- Error logging

### 5. Loading States

**Before (Bad):**
```javascript
{loading && <div>Loading...</div>}
```

**After (Good):**
```javascript
import { LoadingSpinner } from './components/ui';

{isLoading && <LoadingSpinner size="md" text="Loading stock data..." />}
```

### 6. Empty States

**Before (Bad):**
```javascript
{data.length === 0 && <div>No data</div>}
```

**After (Good):**
```javascript
import { EmptyState } from './components/ui';

{data.length === 0 && (
  <EmptyState
    title="No watchlist items"
    description="Add stocks to your watchlist to see them here"
    action={<button>Add Stock</button>}
  />
)}
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

### Available Hooks

#### Stock Hooks
```javascript
import {
  useStockPrice,      // Get stock price
  useStockSentiment,  // Get sentiment
  useStockEvents,     // Get significant events
  useStockData,       // Get all data at once
  useWatchlist,       // Manage watchlist
} from './hooks';
```

#### News Hooks
```javascript
import {
  useNews,            // Get news articles
  useDailySentiment,  // Get daily sentiment
  useFilteredNews,    // Filter by sentiment
  useNewsStats,       // Get news statistics
} from './hooks';
```

#### Utility Hooks
```javascript
import {
  useSearch,          // Search with debouncing
  useDebounce,        // Manual debouncing
} from './hooks';
```

### UI Components

```javascript
import {
  LoadingSpinner,
  ErrorMessage,
  EmptyState,
} from './components/ui';

// Loading
<LoadingSpinner size="md" text="Loading..." fullScreen />

// Error
<ErrorMessage
  title="Error"
  message={error.message}
  onRetry={refetch}
/>

// Empty
<EmptyState
  title="No data"
  description="Try adjusting your filters"
  action={<button>Reload</button>}
/>
```

### Using the Store

```javascript
import useAppStore from './store/useAppStore';

function Component() {
  // Get state
  const { theme, sidebarOpen, watchlist } = useAppStore();

  // Get actions
  const { toggleTheme, addToWatchlist, removeFromWatchlist, isInWatchlist } = useAppStore();

  // Use them
  return (
    <div className={theme}>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => addToWatchlist('AAPL')}>
        Add to Watchlist
      </button>
    </div>
  );
}
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

## Common Patterns

### 1. Conditional Rendering

```javascript
const { data, isLoading, error } = useStockPrice(ticker);

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <DataDisplay data={data} />;
```

### 2. Dependent Queries

```javascript
const { data: ticker } = useSelectedTicker();
const { data: price } = useStockPrice(ticker, {
  enabled: !!ticker, // Only run if ticker exists
});
```

### 3. Polling/Auto-refetch

```javascript
const { data } = useStockPrice(ticker, '1Y', {
  refetchInterval: 60000, // Refetch every 60 seconds
});
```

### 4. Optimistic Updates

```javascript
const { mutate } = useMutation({
  mutationFn: addToWatchlist,
  onMutate: async (ticker) => {
    // Optimistically update UI
    queryClient.setQueryData(['watchlist'], (old) => [...old, ticker]);
  },
});
```

## Debugging

### Check React Query Cache

```javascript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
console.log(queryClient.getQueryData(['stockPrice', 'AAPL']));
```

### Check Store State

```javascript
const state = useAppStore.getState();
console.log(state);
```

### API Logs

All API calls are logged in development mode:
```
[Request] API Request: GET /api/price?ticker=AAPL
[Response] API Response: 200 OK (543ms)
```

## Checklist for New Features

- [ ] Use custom hooks instead of direct API calls
- [ ] Add loading states with `<LoadingSpinner />`
- [ ] Add error handling with `<ErrorMessage />`
- [ ] Add empty states with `<EmptyState />`
- [ ] Wrap in `<ErrorBoundary>` if critical
- [ ] Use Zustand for client state
- [ ] Use React Query for server state
- [ ] Add debouncing for search/input
- [ ] Test error scenarios
- [ ] Check mobile responsiveness

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

- [Shared Components](src/features/shared/README.md) - Shared component documentation
- [Notifications](src/features/notifications/README.md) - Notification system documentation
- [Root README](../README.md) - Project overview
- [Backend API](../backend/README.md) - API documentation
- [React Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://github.com/pmndrs/zustand)
