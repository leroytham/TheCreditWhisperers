/**
 * Validation schemas index.
 *
 * Central export point for all Zod validation schemas.
 */

// Portfolio schemas
export {
  holdingSchema,
  accountDetailsSchema,
  portfolioCreateSchema,
  validateForm,
  getFirstError,
  type Holding,
  type AccountDetails,
  type PortfolioCreate,
  type ValidationResult,
} from './portfolio';

// Auth schemas
export {
  loginSchema,
  signupSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  type LoginForm,
  type SignupForm,
  type PasswordResetRequest,
  type PasswordReset,
} from './auth';
