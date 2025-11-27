/**
 * Portfolio validation schemas using Zod v4.
 *
 * These schemas mirror the backend Pydantic validation while matching
 * the frontend form structure. Use these to validate form data before
 * API submission.
 */

import { z } from 'zod';

// =============================================================================
// HOLDING SCHEMAS
// =============================================================================

/**
 * Schema for a single holding in the portfolio.
 * Matches the form fields in AddPortfolioModal/EditPortfolioModal.
 */
export const holdingSchema = z.object({
  symbol: z
    .string({ error: 'Symbol is required' })
    .min(1, 'Symbol is required')
    .max(10, 'Symbol must be 10 characters or less')
    .regex(/^[A-Z0-9.-]+$/i, 'Invalid ticker format')
    .transform((val) => val.toUpperCase()),
  quantity: z.coerce
    .number({ error: 'Quantity must be a number' })
    .positive('Quantity must be greater than 0')
    .max(1e12, 'Quantity is too large'),
  purchasePrice: z.coerce
    .number({ error: 'Purchase price must be a number' })
    .positive('Purchase price must be greater than 0')
    .max(1e9, 'Purchase price is too large'),
  purchaseDate: z.string().optional(),
});

export type Holding = z.infer<typeof holdingSchema>;

// =============================================================================
// ACCOUNT DETAILS SCHEMA
// =============================================================================

/**
 * Schema for account details (Step 1 of portfolio creation).
 */
export const accountDetailsSchema = z.object({
  accountName: z
    .string()
    .min(1, 'Account name is required')
    .max(100, 'Account name must be 100 characters or less'),
  accountNumber: z
    .string()
    .min(1, 'Account number is required')
    .max(50, 'Account number must be 50 characters or less'),
  openDate: z.string().min(1, 'Open date is required'),
});

export type AccountDetails = z.infer<typeof accountDetailsSchema>;

// =============================================================================
// FULL PORTFOLIO SCHEMA
// =============================================================================

/**
 * Complete portfolio schema for AddPortfolioModal form submission.
 */
export const portfolioCreateSchema = z.object({
  accountDetails: accountDetailsSchema,
  holdings: z.array(holdingSchema).min(1, 'At least one holding is required'),
});

export type PortfolioCreate = z.infer<typeof portfolioCreateSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Result type for form validation.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

/**
 * Validate form data against a Zod schema.
 *
 * @example
 * const result = validateForm(portfolioCreateSchema, formData);
 * if (!result.success) {
 *   notifyWarning(Object.values(result.errors)[0]);
 *   return;
 * }
 * // result.data is typed and validated
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  // Zod v4 uses 'issues' instead of 'errors'
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    // Only keep the first error for each path
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });

  return { success: false, errors };
}

/**
 * Get the first validation error message.
 * Useful for showing a single toast notification.
 */
export function getFirstError(errors: Record<string, string>): string {
  return Object.values(errors)[0] || 'Validation failed';
}
