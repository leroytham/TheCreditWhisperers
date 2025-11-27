import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/**
 * Create a fresh QueryClient for each test
 * - Disables retries for predictable test behavior
 * - Sets gcTime to 0 to avoid caching between tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial route for MemoryRouter
   * @default '/'
   */
  initialRoute?: string;
  /**
   * Custom QueryClient instance
   * @default createTestQueryClient()
   */
  queryClient?: QueryClient;
}

/**
 * Custom render function that wraps components with necessary providers
 * - QueryClientProvider for React Query
 * - MemoryRouter for routing
 *
 * @example
 * ```tsx
 * import { render, screen } from '../test-utils';
 *
 * test('renders component', () => {
 *   render(<MyComponent />, { initialRoute: '/dashboard' });
 *   expect(screen.getByText('Dashboard')).toBeInTheDocument();
 * });
 * ```
 */
function customRender(
  ui: ReactElement,
  {
    initialRoute = '/',
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with customRender
export { customRender as render };
