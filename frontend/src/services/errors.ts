/**
 * Structured API Error class for programmatic error handling.
 *
 * DESIGN: Extends native Error to preserve backward compatibility.
 * All existing code patterns (error.message, error.message?.includes())
 * continue to work unchanged.
 *
 * @example
 * // Old pattern still works:
 * if (error.message?.includes('Session expired')) navigate('/login');
 *
 * // New pattern (recommended):
 * if (isAuthError(error)) navigate('/login');
 */

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface ApiErrorOptions {
  message: string;
  status?: number;
  code: ApiErrorCode;
  errorId?: string;
  isRetryable?: boolean;
}

export class ApiError extends Error {
  /** HTTP status code (e.g., 401, 404, 500). Undefined for network errors. */
  readonly status?: number;

  /** Error code for programmatic handling (e.g., 'UNAUTHORIZED', 'NOT_FOUND') */
  readonly code: ApiErrorCode;

  /** Backend error reference ID for support (available on 5xx errors) */
  readonly errorId?: string;

  /** Whether this error can be retried (e.g., network, timeout, 5xx) */
  readonly isRetryable: boolean;

  constructor(options: ApiErrorOptions) {
    // CRITICAL: Pass message to parent Error constructor
    // This ensures error.message works for ALL existing code
    super(options.message);

    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.errorId = options.errorId;
    this.isRetryable = options.isRetryable ?? false;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// =============================================================================
// TYPE GUARDS - Safe error checking without instanceof everywhere
// =============================================================================

/**
 * Type guard to check if error is an ApiError.
 *
 * @example
 * catch (error) {
 *   if (isApiError(error)) {
 *     console.log(error.status, error.code); // TypeScript knows these exist
 *   }
 * }
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if error is an authentication error (401 Unauthorized).
 *
 * @example
 * if (isAuthError(error)) navigate('/login');
 */
export function isAuthError(error: unknown): boolean {
  return isApiError(error) && error.code === 'UNAUTHORIZED';
}

/**
 * Check if error is a network error (no response from server).
 */
export function isNetworkError(error: unknown): boolean {
  return isApiError(error) && error.code === 'NETWORK_ERROR';
}

/**
 * Check if error is a server error (5xx status codes).
 */
export function isServerError(error: unknown): boolean {
  return isApiError(error) && (error.status ?? 0) >= 500;
}

/**
 * Check if error is a not found error (404).
 */
export function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && error.code === 'NOT_FOUND';
}

/**
 * Check if error is a forbidden error (403).
 */
export function isForbiddenError(error: unknown): boolean {
  return isApiError(error) && error.code === 'FORBIDDEN';
}

/**
 * Check if error is a validation error (400, 422).
 */
export function isValidationError(error: unknown): boolean {
  return isApiError(error) && error.code === 'VALIDATION_ERROR';
}

/**
 * Check if error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  return isApiError(error) && error.isRetryable;
}
