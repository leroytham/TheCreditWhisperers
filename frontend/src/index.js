import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// =============================================================================
// SENTRY ERROR TRACKING
// =============================================================================
// Initialize Sentry for frontend error tracking and performance monitoring.
// Set REACT_APP_SENTRY_DSN environment variable to enable.
if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,

    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Session Replay (captures user sessions for debugging)
    replaysSessionSampleRate: 0.1,  // 10% of sessions
    replaysOnErrorSampleRate: 1.0,  // 100% of sessions with errors

    // Environment tagging
    environment: process.env.NODE_ENV,

    // Release tracking (set via CI/CD)
    release: process.env.REACT_APP_VERSION || '1.0.0',

    // Integration options
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Don't send PII
    sendDefaultPii: false,

    // Filter out noisy errors
    beforeSend(event) {
      // Filter out chunk loading errors (common in SPAs)
      if (event.exception?.values?.[0]?.value?.includes('ChunkLoadError')) {
        return null;
      }
      return event;
    },
  });

  console.log('Sentry error tracking initialized');
}

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // Data is fresh for 30 seconds
      cacheTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      retry: 1, // Retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on reconnect
    },
    mutations: {
      retry: 1,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // Temporarily disabled StrictMode to prevent double-mounting during development
  // <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
