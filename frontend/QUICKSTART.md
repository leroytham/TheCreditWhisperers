# Frontend Best Practices - Quick Start Guide

## Installation

```bash
cd frontend
npm install
```

New dependencies added:
- `@tanstack/react-query` - Data fetching & caching
- `@tanstack/react-query-devtools` - DevTools for debugging
- `zustand` - State management
- `axios` - HTTP client
- `react-error-boundary` - Error handling

## Project Structure

```
src/
├── components/
│   ├── errors/ErrorBoundary.js     # Error boundaries
│   └── ui/                         # Reusable UI components
├── hooks/                          # Custom hooks
├── services/api.js                 # API service
├── store/useAppStore.js            # Global state
├── config/constants.js             # App constants
└── utils/queryClient.js            # React Query config
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

## Available Hooks

### Stock Hooks
```javascript
import {
  useStockPrice,      // Get stock price
  useStockSentiment,  // Get sentiment
  useStockEvents,     // Get significant events
  useStockData,       // Get all data at once
  useWatchlist,       // Manage watchlist
} from './hooks';
```

### News Hooks
```javascript
import {
  useNews,            // Get news articles
  useDailySentiment,  // Get daily sentiment
  useFilteredNews,    // Filter by sentiment
  useNewsStats,       // Get news statistics
} from './hooks';
```

### Utility Hooks
```javascript
import {
  useSearch,          // Search with debouncing
  useDebounce,        // Manual debouncing
} from './hooks';
```

## UI Components

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

## Using the Store

```javascript
import useAppStore from './store/useAppStore';

function Component() {
  // Get state
  const { theme, sidebarOpen, watchlist } = useAppStore();

  // Get actions
  const { toggleTheme, addToWatchlist } = useAppStore();

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

## Data Flow

```
User Action
    ↓
Component calls hook (useStockPrice)
    ↓
React Query checks cache
    ↓
If cached: Return data ✅
If not cached: Call API ⬇️
    ↓
API Service (with interceptors)
    ↓
Backend API
    ↓
Response → Cache → Component (done)
```

## DevTools

### React Query DevTools

Add to your App.js:
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

Already configured! Open Redux DevTools in browser.

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

## Further Reading

- [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) - Detailed architecture docs
- [React Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://github.com/pmndrs/zustand)

## Common Issues

### Issue: "Cannot find module '@tanstack/react-query'"

**Solution:**
```bash
npm install
```

### Issue: API calls not working

**Solution:**
Check `proxy` in package.json points to backend:
```json
{
  "proxy": "http://127.0.0.1:8000"
}
```

### Issue: State not persisting

**Solution:**
Check browser localStorage - Zustand persists automatically.

---

**Status:** Ready to use. Start building with best practices from day one.
