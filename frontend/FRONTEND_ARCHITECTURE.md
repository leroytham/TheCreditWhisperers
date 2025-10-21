# Frontend Architecture & Best Practices

## Overview

This document outlines the frontend architecture, best practices, and patterns used in The Credit Whisperers application. The frontend is built with **React 19**, **React Query (TanStack Query)**, **Zustand**, and follows modern React patterns.

## Tech Stack

- **React 19.1.1** - UI library
- **React Query (TanStack Query)** - Server state management & caching
- **Zustand** - Client state management
- **Axios** - HTTP client with interceptors
- **React Router DOM** - Routing
- **React Error Boundary** - Error handling
- **Lucide React** - Icons
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization

## Project Structure

```
frontend/src/
├── components/
│   ├── errors/
│   │   └── ErrorBoundary.js       # Global error boundary
│   ├── ui/
│   │   ├── LoadingSpinner.js      # Loading states
│   │   ├── ErrorMessage.js        # Error displays
│   │   └── EmptyState.js          # Empty states
│   └── [feature-components]/      # Feature-specific components
│
├── hooks/
│   ├── index.js                   # Centralized exports
│   ├── useStock.js                # Stock data hooks
│   ├── useNews.js                 # News data hooks
│   ├── useSearch.js               # Search functionality
│   └── useDebounce.js             # Utility hooks
│
├── services/
│   └── api.js                     # API service with interceptors
│
├── store/
│   └── useAppStore.js             # Zustand global state
│
├── config/
│   └── constants.js               # App constants
│
├── utils/
│   └── queryClient.js             # React Query configuration
│
├── pages/                         # Page components
├── App.js                         # Root component
└── index.js                       # Entry point
```

## State Management

### 1. Server State (React Query)

Used for **data fetching, caching, and synchronization** with the backend.

**Benefits:**
- Automatic caching
- Background refetching
- Optimistic updates
- Request deduplication
- Automatic retry logic
- DevTools for debugging

**Example:**
```javascript
import { useStockPrice } from './hooks';

function StockChart({ ticker }) {
  const { data, isLoading, error, refetch } = useStockPrice(ticker, '1Y');

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;

  return <Chart data={data.prices} />;
}
```

### 2. Client State (Zustand)

Used for **UI state, user preferences, and non-server data**.

**Benefits:**
- Simple API
- No boilerplate
- TypeScript support
- DevTools integration
- Persistent storage
- Small bundle size

**Example:**
```javascript
import useAppStore from './store/useAppStore';

function Sidebar() {
  const { sidebarOpen, toggleSidebar, watchlist } = useAppStore();

  return (
    <div className={sidebarOpen ? 'open' : 'closed'}>
      <button onClick={toggleSidebar}>Toggle</button>
      <WatchlistView tickers={watchlist} />
    </div>
  );
}
```

## Custom Hooks

### Stock Hooks

```javascript
import { useStockPrice, useStockData, useWatchlist } from './hooks';

// Single data point
const { data, isLoading, error } = useStockPrice('AAPL', '1Y');

// Combined data
const { price, sentiment, events, isLoading } = useStockData('AAPL', '1Y');

// Watchlist management
const { watchlist, addToWatchlist, isInWatchlist } = useWatchlist();
```

### News Hooks

```javascript
import { useNews, useDailySentiment, useFilteredNews } from './hooks';

// Get news
const { data, isLoading } = useNews('AAPL');

// Get daily sentiment
const { data: dailyData } = useDailySentiment('AAPL');

// Filtered news
const { data: filteredData } = useFilteredNews('AAPL', 'positive');
```

### Utility Hooks

```javascript
import { useSearch, useDebounce } from './hooks';

// Search with debouncing
const { searchQuery, setSearchQuery, results, isSearching } = useSearch();

// Manual debouncing
const debouncedValue = useDebounce(inputValue, 300);
```

## API Service

### Centralized API Layer

All API calls go through the `apiService`:

```javascript
import apiService from './services/api';

// Use in components (not recommended - use hooks instead)
const data = await apiService.getStockPrice('AAPL', '1Y');

// Better: Use custom hooks
const { data } = useStockPrice('AAPL', '1Y');
```

### Features

1. **Request Interceptors**
   - Add auth tokens
   - Log requests (development)
   - Add metadata

2. **Response Interceptors**
   - Handle errors globally
   - Automatic retry logic
   - Response logging
   - Duration tracking

3. **Error Handling**
   - HTTP status code mapping
   - User-friendly error messages
   - Automatic token refresh
   - Network error detection

## Error Handling

### 1. Error Boundaries

Catch React errors and prevent app crashes:

```javascript
import ErrorBoundary from './components/errors/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

### 2. Query Error Handling

```javascript
const { data, error, isError, refetch } = useStockPrice('AAPL');

if (isError) {
  return <ErrorMessage message={error.message} onRetry={refetch} />;
}
```

### 3. Component-Level Error Handling

```javascript
function StockCard({ ticker }) {
  return (
    <ErrorBoundary
      onError={(error) => console.error('StockCard error:', error)}
      onReset={() => window.location.reload()}
    >
      <StockContent ticker={ticker} />
    </ErrorBoundary>
  );
}
```

## Loading States

### 1. Component-Level Loading

```javascript
function StockPrice({ ticker }) {
  const { data, isLoading } = useStockPrice(ticker);

  if (isLoading) {
    return <LoadingSpinner size="md" text="Loading price data..." />;
  }

  return <PriceDisplay data={data} />;
}
```

### 2. Skeleton Loaders

```javascript
function StockCard({ ticker }) {
  const { data, isLoading } = useStockPrice(ticker);

  return (
    <div className="card">
      {isLoading ? (
        <SkeletonLoader />
      ) : (
        <StockContent data={data} />
      )}
    </div>
  );
}
```

### 3. Suspense (React 19)

```javascript
import { Suspense } from 'react';

function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <StockDashboard />
    </Suspense>
  );
}
```

## Performance Optimization

### 1. React Query Caching

```javascript
// Automatic caching with stale time
const { data } = useStockPrice('AAPL', '1Y', {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

### 2. Prefetching

```javascript
import { usePrefetchStock } from './hooks';

function WatchlistItem({ ticker }) {
  const { prefetchPrice, prefetchSentiment } = usePrefetchStock();

  return (
    <div
      onMouseEnter={() => {
        prefetchPrice(ticker);
        prefetchSentiment(ticker);
      }}
    >
      {ticker}
    </div>
  );
}
```

### 3. Debouncing

```javascript
function SearchBar() {
  const [input, setInput] = useState('');
  const debouncedInput = useDebounce(input, 300);

  // Only searches after user stops typing for 300ms
  const { results } = useSearch(debouncedInput);
}
```

### 4. Code Splitting

```javascript
import { lazy, Suspense } from 'react';

const StockDashboard = lazy(() => import('./pages/StockDashboard'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <StockDashboard />
    </Suspense>
  );
}
```

### 5. Memoization

```javascript
import { useMemo } from 'react';

function StockChart({ data }) {
  const chartData = useMemo(() => {
    return transformDataForChart(data);
  }, [data]);

  return <Chart data={chartData} />;
}
```

## Best Practices

### 1. Component Structure

```javascript
// ✅ Good: Single responsibility
function StockPrice({ ticker }) {
  const { data, isLoading, error } = useStockPrice(ticker);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;

  return <div className="price">${data.price}</div>;
}

// ❌ Bad: Multiple responsibilities
function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return <div>{/* ... */}</div>;
}
```

### 2. Custom Hooks

```javascript
// ✅ Good: Reusable logic
function useStockPrice(ticker) {
  return useQuery({
    queryKey: ['stockPrice', ticker],
    queryFn: () => apiService.getStockPrice(ticker),
  });
}

// Usage
const { data } = useStockPrice('AAPL');

// ❌ Bad: Logic in component
function StockCard({ ticker }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiService.getStockPrice(ticker).then(setData);
  }, [ticker]);
}
```

### 3. Error Handling

```javascript
// ✅ Good: Comprehensive error handling
function StockData({ ticker }) {
  const { data, isLoading, error, refetch } = useStockPrice(ticker);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!data) return <EmptyState title="No data available" />;

  return <DataDisplay data={data} />;
}

// ❌ Bad: No error handling
function StockData({ ticker }) {
  const { data } = useStockPrice(ticker);
  return <DataDisplay data={data} />; // Crashes if data is null
}
```

### 4. State Management

```javascript
// ✅ Good: Separate concerns
// Server state with React Query
const { data } = useStockPrice('AAPL');

// Client state with Zustand
const { sidebarOpen } = useAppStore();

// ❌ Bad: Everything in component state
const [stockData, setStockData] = useState(null);
const [sidebarOpen, setSidebarOpen] = useState(true);
```

### 5. API Calls

```javascript
// ✅ Good: Use custom hooks
function StockCard({ ticker }) {
  const { data, isLoading } = useStockPrice(ticker);
  // React Query handles caching, retries, etc.
}

// ❌ Bad: Direct API calls in components
function StockCard({ ticker }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiService.getStockPrice(ticker).then(setData);
  }, [ticker]);
}
```

## Naming Conventions

- **Components**: PascalCase (`StockCard`, `LoadingSpinner`)
- **Hooks**: camelCase with `use` prefix (`useStockPrice`, `useDebounce`)
- **Utilities**: camelCase (`formatPrice`, `calculateChange`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `CACHE_TIMES`)
- **Props**: camelCase (`ticker`, `timeframe`, `onSelect`)

## File Organization

```
components/
├── [feature]/              # Group by feature
│   ├── index.js           # Barrel export
│   ├── FeatureName.js     # Main component
│   ├── FeatureItem.js     # Sub-components
│   └── FeatureName.test.js # Tests
│
└── ui/                    # Shared UI components
    ├── Button.js
    ├── Card.js
    └── Modal.js
```

## Testing Strategy

### 1. Unit Tests

```javascript
import { render, screen } from '@testing-library/react';
import StockPrice from './StockPrice';

test('displays loading spinner', () => {
  render(<StockPrice ticker="AAPL" />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
```

### 2. Integration Tests

```javascript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

test('fetches and displays stock price', async () => {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <StockPrice ticker="AAPL" />
    </QueryClientProvider>
  );

  expect(await screen.findByText(/\$150/)).toBeInTheDocument();
});
```

## Deployment Checklist

- [ ] Remove console.logs from production code
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Enable production API endpoints
- [ ] Optimize bundle size
- [ ] Set up CI/CD pipeline
- [ ] Configure environment variables
- [ ] Test on multiple browsers
- [ ] Performance audit with Lighthouse
- [ ] Security audit
- [ ] Accessibility testing

## Resources

- [React Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [React Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Axios Docs](https://axios-http.com/)

## Summary

✅ **Implemented:**
- React Query for server state management
- Zustand for client state management
- Custom hooks for data fetching
- Error boundaries for error handling
- Loading and empty states
- API service with interceptors
- Performance optimizations

🎯 **Benefits:**
- Clean separation of concerns
- Automatic caching and refetching
- Type-safe state management
- Comprehensive error handling
- Better developer experience
- Optimized performance
