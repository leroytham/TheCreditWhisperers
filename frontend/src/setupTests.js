// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// =============================================================================
// NODE.JS POLYFILLS FOR BROWSER APIS
// =============================================================================

// TextEncoder/TextDecoder are used by react-router v7
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// =============================================================================
// BROWSER API MOCKS
// =============================================================================

// Mock matchMedia (used by responsive hooks and components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated but still used by some libraries
    removeListener: jest.fn(), // Deprecated but still used by some libraries
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver (used by charts and virtualized lists)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver (used by lazy loading and infinite scroll)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: jest.fn().mockReturnValue([]),
}));

// Mock scrollTo (used by scroll-to-top and navigation)
window.scrollTo = jest.fn();
Element.prototype.scrollTo = jest.fn();
Element.prototype.scrollIntoView = jest.fn();

// Mock requestAnimationFrame (used by animations and charts)
window.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
window.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock fetch (if not using axios exclusively)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
  })
);

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// =============================================================================
// CONSOLE SUPPRESSION FOR KNOWN WARNINGS
// =============================================================================

const originalError = console.error;
const originalWarn = console.warn;

// Suppress specific warnings that clutter test output
console.error = (...args) => {
  // Suppress React 18 act() warnings in tests
  if (typeof args[0] === 'string' && args[0].includes('act(...)')) {
    return;
  }
  // Suppress known React warnings about state updates
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: An update to') &&
    args[0].includes('inside a test was not wrapped in act')
  ) {
    return;
  }
  originalError.call(console, ...args);
};

console.warn = (...args) => {
  // Suppress React Router future flag warnings in tests
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return;
  }
  originalWarn.call(console, ...args);
};

// =============================================================================
// GLOBAL TEST UTILITIES
// =============================================================================

// Flush all pending promises
global.flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// Wait for specific condition with timeout
global.waitForCondition = async (condition, timeout = 5000) => {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

// =============================================================================
// CLEANUP
// =============================================================================

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
});
