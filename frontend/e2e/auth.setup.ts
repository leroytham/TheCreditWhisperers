import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Authentication Setup for E2E Tests
 *
 * This setup runs before all tests to establish an authenticated session.
 * For Azure AD OAuth, we mock the authentication flow in E2E tests
 * since real OAuth requires user interaction.
 *
 * In CI/CD, you can:
 * 1. Use test credentials with a test tenant
 * 2. Mock the auth endpoints
 * 3. Use API tokens for backend authentication
 */
setup('authenticate', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/login');

  // Wait for the page to load
  await expect(page).toHaveURL(/.*login/);

  // Check if we're in a test environment with mocked auth
  const isTestEnv = process.env.E2E_TEST_MODE === 'true';

  if (isTestEnv) {
    // In test mode, we can mock the authentication
    // by setting localStorage directly or using a test API endpoint

    // Mock user data for testing
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      isAuthenticated: true,
    };

    // Set mock auth state in localStorage
    await page.evaluate((user) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isAuthenticated', 'true');
    }, mockUser);

    // Navigate to home page to verify auth
    await page.goto('/');
    await expect(page.locator('[data-testid="user-menu"]').or(page.locator('text=Dashboard'))).toBeVisible({
      timeout: 10000,
    });
  } else {
    // For manual testing or with real Azure AD credentials
    // This would require actual OAuth flow completion

    // Check for Azure AD login button
    const loginButton = page.locator('button:has-text("Sign in"), [data-testid="login-button"]');

    if (await loginButton.isVisible()) {
      // In a real scenario, you would:
      // 1. Click the login button
      // 2. Handle the Azure AD redirect
      // 3. Enter credentials
      // 4. Complete the OAuth flow

      console.log('OAuth flow detected. For E2E tests, set E2E_TEST_MODE=true to use mocked auth.');
    }
  }

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

/**
 * Test that unauthenticated users are redirected to login
 */
setup.describe('Unauthenticated Access', () => {
  setup('redirects to login when not authenticated', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Try to access protected route
    await page.goto('/portfolio');

    // Should be redirected to login
    await expect(page).toHaveURL(/.*login/, { timeout: 5000 });
  });
});
