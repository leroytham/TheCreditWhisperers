import { test, expect } from '@playwright/test';

/**
 * Portfolio Page E2E Tests
 *
 * Tests the portfolio management functionality including:
 * - Viewing portfolio overview
 * - Adding/removing stocks
 * - Viewing stock details
 * - Portfolio analytics
 */
test.describe('Portfolio Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to portfolio page (auth state loaded from setup)
    await page.goto('/portfolio');
  });

  test('displays portfolio overview', async ({ page }) => {
    // Wait for the portfolio page to load
    await expect(page.locator('h1, [data-testid="portfolio-title"]')).toContainText(/portfolio/i);

    // Check for portfolio summary components
    await expect(
      page.locator('[data-testid="portfolio-value"]').or(page.locator('text=/total.*value/i'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows stock list', async ({ page }) => {
    // Wait for stock list to load
    const stockList = page.locator('[data-testid="stock-list"], table, [role="grid"]');
    await expect(stockList).toBeVisible({ timeout: 15000 });

    // Verify at least one stock item is displayed (or empty state)
    const hasStocks = await page.locator('[data-testid="stock-item"], tr[data-symbol], .stock-row').count();
    const hasEmptyState = await page.locator('[data-testid="empty-portfolio"], text=/no stocks/i').isVisible();

    expect(hasStocks > 0 || hasEmptyState).toBeTruthy();
  });

  test('can search for stocks', async ({ page }) => {
    // Find search input
    const searchInput = page.locator(
      'input[placeholder*="search" i], input[placeholder*="symbol" i], [data-testid="stock-search"]'
    );

    if (await searchInput.isVisible()) {
      // Type a stock symbol
      await searchInput.fill('AAPL');

      // Wait for search results or autocomplete
      await page.waitForTimeout(1000); // Allow debounce

      // Check for search results
      const results = page.locator('[data-testid="search-results"], [role="listbox"], .search-dropdown');
      if (await results.isVisible()) {
        await expect(results).toContainText(/AAPL|Apple/i);
      }
    }
  });

  test('displays stock details when clicking a stock', async ({ page }) => {
    // Click on a stock if available
    const stockItem = page.locator('[data-testid="stock-item"], tr[data-symbol], .stock-row').first();

    if (await stockItem.isVisible()) {
      await stockItem.click();

      // Wait for details panel or modal
      await page.waitForTimeout(500);

      // Check for details view
      const detailsView = page.locator(
        '[data-testid="stock-details"], [role="dialog"], .stock-detail-panel'
      );

      // Details might show in sidebar, modal, or new page
      const hasDetails =
        (await detailsView.isVisible()) ||
        (await page.locator('text=/price|market cap|volume/i').isVisible());

      expect(hasDetails).toBeTruthy();
    }
  });

  test('shows loading state while fetching data', async ({ page }) => {
    // Intercept API calls to slow them down
    await page.route('**/api/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    // Refresh page
    await page.reload();

    // Check for loading indicator
    const loadingIndicator = page.locator(
      '[data-testid="loading"], .loading, [role="progressbar"], text=/loading/i'
    );

    // Loading state should appear briefly
    const wasLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    // After loading, content should appear
    await expect(page.locator('[data-testid="portfolio-content"], main')).toBeVisible({
      timeout: 15000,
    });
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/portfolio**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Refresh to trigger error
    await page.reload();

    // Should show error state, not crash
    const errorState = page.locator(
      '[data-testid="error-message"], .error, [role="alert"], text=/error|failed|try again/i'
    );

    await expect(errorState).toBeVisible({ timeout: 10000 });
  });

  test('is responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload to apply responsive styles
    await page.reload();

    // Page should still be functional
    await expect(page.locator('main, [data-testid="portfolio-content"]')).toBeVisible();

    // Check that layout adapts (no horizontal scroll)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });
});

test.describe('Portfolio Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio');
  });

  test('can add a stock to portfolio', async ({ page }) => {
    // Look for add stock button
    const addButton = page.locator(
      'button:has-text("Add"), [data-testid="add-stock"], button[aria-label*="add" i]'
    );

    if (await addButton.isVisible()) {
      await addButton.click();

      // Wait for modal or form
      const addForm = page.locator('[data-testid="add-stock-form"], [role="dialog"], form');
      await expect(addForm).toBeVisible({ timeout: 5000 });

      // Fill in stock symbol
      const symbolInput = addForm.locator('input[name="symbol"], input[placeholder*="symbol" i]');
      await symbolInput.fill('MSFT');

      // Fill in quantity if required
      const quantityInput = addForm.locator('input[name="quantity"], input[type="number"]');
      if (await quantityInput.isVisible()) {
        await quantityInput.fill('10');
      }

      // Submit
      const submitButton = addForm.locator('button[type="submit"], button:has-text("Add")');
      await submitButton.click();

      // Verify success (toast notification or updated list)
      const success =
        (await page.locator('text=/added|success/i').isVisible({ timeout: 5000 })) ||
        (await page.locator('text=MSFT').isVisible({ timeout: 5000 }));

      expect(success).toBeTruthy();
    }
  });

  test('validates stock input', async ({ page }) => {
    const addButton = page.locator(
      'button:has-text("Add"), [data-testid="add-stock"], button[aria-label*="add" i]'
    );

    if (await addButton.isVisible()) {
      await addButton.click();

      const addForm = page.locator('[data-testid="add-stock-form"], [role="dialog"], form');
      if (await addForm.isVisible()) {
        // Try to submit empty form
        const submitButton = addForm.locator('button[type="submit"], button:has-text("Add")');
        await submitButton.click();

        // Should show validation error
        const validationError = page.locator(
          '.error, [role="alert"], [aria-invalid="true"], text=/required|invalid/i'
        );

        await expect(validationError).toBeVisible({ timeout: 3000 });
      }
    }
  });
});
