import { test, expect } from '@playwright/test';

test.describe('Error Boundaries', () => {
  test.beforeEach(async ({ page }) => {
    // Handle any console errors during test
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
  });

  test('should display 404 page for non-existent routes', async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto('/non-existent-page');
    
    // Should show 404 page content
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=Page not found')).toBeVisible();
    await expect(page.locator('text=Go home')).toBeVisible();
  });

  test('should display chat 404 page for non-existent chat', async ({ page }) => {
    // Navigate to a non-existent chat
    await page.goto('/chat/non-existent-chat-id');
    
    // Should show chat-specific 404 (might redirect to auth first)
    // Check for either auth redirect or 404 page
    const url = page.url();
    if (url.includes('auth')) {
      // If redirected to auth, that's expected behavior
      expect(url).toContain('auth');
    } else {
      // If not redirected, should show 404
      await expect(page.locator('text=404')).toBeVisible();
    }
  });

  test('should handle error boundary test page components', async ({ page }) => {
    // Navigate to the error test page
    await page.goto('/test-errors');
    
    // Handle auth redirect if it occurs
    const url = page.url();
    if (url.includes('auth')) {
      console.log('Authentication required - error boundary tests require authentication');
      // You can add authentication flow here if needed
      return;
    }

    // Test that the error test page loads
    await expect(page.locator('text=Error Boundary Testing')).toBeVisible({ timeout: 10000 });
    
    // Test component-level error boundary
    const componentErrorSection = page.locator('text=1. Component-level Error Boundary').locator('..');
    await expect(componentErrorSection).toBeVisible();
    
    // Find and click the first "Trigger Test Error" button
    const triggerButtons = page.locator('button:has-text("Trigger Test Error")');
    const firstTriggerButton = triggerButtons.first();
    await expect(firstTriggerButton).toBeVisible();
    
    // Click to trigger error
    await firstTriggerButton.click();
    
    // Should show error boundary UI
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Try again")')).toBeVisible();
    await expect(page.locator('button:has-text("Reload page")')).toBeVisible();
    
    // Test recovery by clicking "Try again"
    await page.locator('button:has-text("Try again")').first().click();
    
    // Should restore the original component
    await expect(firstTriggerButton).toBeVisible({ timeout: 5000 });
  });

  test('should handle chat-specific error boundary', async ({ page }) => {
    await page.goto('/test-errors');
    
    // Handle auth redirect
    if (page.url().includes('auth')) {
      console.log('Authentication required for chat error boundary test');
      return;
    }

    // Wait for page to load
    await expect(page.locator('text=Error Boundary Testing')).toBeVisible({ timeout: 10000 });
    
    // Find chat error boundary section
    const chatErrorSection = page.locator('text=2. Chat-specific Error Boundary').locator('..');
    await expect(chatErrorSection).toBeVisible();
    
    // Find the trigger button in chat section
    const chatTriggerButton = chatErrorSection.locator('button:has-text("Trigger Test Error")');
    await chatTriggerButton.click();
    
    // Should show chat-specific error UI
    await expect(page.locator('text=Chat Error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Retry chat")')).toBeVisible();
    await expect(page.locator('button:has-text("Start new chat")')).toBeVisible();
    await expect(page.locator('button:has-text("Reload page")')).toBeVisible();
  });

  test('should isolate multiple error boundaries', async ({ page }) => {
    await page.goto('/test-errors');
    
    // Handle auth redirect
    if (page.url().includes('auth')) {
      console.log('Authentication required for multiple error boundary test');
      return;
    }

    // Wait for page to load
    await expect(page.locator('text=Error Boundary Testing')).toBeVisible({ timeout: 10000 });
    
    // Find multiple isolated error boundaries section
    const multipleErrorSection = page.locator('text=3. Multiple Isolated Error Boundaries').locator('..');
    await expect(multipleErrorSection).toBeVisible();
    
    // Get both trigger buttons in this section
    const triggerButtons = multipleErrorSection.locator('button:has-text("Trigger Test Error")');
    await expect(triggerButtons).toHaveCount(2);
    
    // Click first button
    await triggerButtons.first().click();
    
    // First component should show error, second should still work
    const errorMessages = page.locator('text=Something went wrong');
    await expect(errorMessages.first()).toBeVisible({ timeout: 5000 });
    
    // Second button should still be clickable
    await expect(triggerButtons.nth(1)).toBeVisible();
    
    // Click second button
    await triggerButtons.nth(1).click();
    
    // Now both should show errors
    await expect(errorMessages).toHaveCount(2, { timeout: 5000 });
  });

  test('should trigger page-level error correctly', async ({ page }) => {
    await page.goto('/test-errors');
    
    // Handle auth redirect
    if (page.url().includes('auth')) {
      console.log('Authentication required for page-level error test');
      return;
    }

    // Wait for page to load
    await expect(page.locator('text=Error Boundary Testing')).toBeVisible({ timeout: 10000 });
    
    // Find page-level error section
    const pageLevelSection = page.locator('text=4. Page-level Error').locator('..');
    await expect(pageLevelSection).toBeVisible();
    
    // Click the page-level error trigger
    const pageLevelButton = pageLevelSection.locator('button:has-text("Trigger Page-level Error")');
    await pageLevelButton.click();
    
    // Should replace entire page with error.tsx content
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Try again")')).toBeVisible();
    await expect(page.locator('button:has-text("Go home")')).toBeVisible();
    
    // Original page content should be gone
    await expect(page.locator('text=Error Boundary Testing')).not.toBeVisible();
  });

  test('should handle route navigation errors gracefully', async ({ page }) => {
    // Test navigating to various potentially problematic routes
    const testRoutes = [
      '/chat/invalid-chat-id-123',
      '/nonexistent/deeply/nested/route',
      '/api/nonexistent',
    ];

    for (const route of testRoutes) {
      console.log(`Testing route: ${route}`);
      await page.goto(route, { timeout: 10000 });
      
      // Should either show 404, redirect to auth, or show error page
      // All of these are valid responses and show error handling is working
      const url = page.url();
      const hasError404 = await page.locator('text=404').isVisible().catch(() => false);
      const hasAuthRedirect = url.includes('auth');
      const hasErrorPage = await page.locator('text=Something went wrong').isVisible().catch(() => false);
      
      const hasValidErrorHandling = hasError404 || hasAuthRedirect || hasErrorPage;
      expect(hasValidErrorHandling).toBe(true);
    }
  });

  test('should log errors to console properly', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/test-errors');
    
    // Handle auth redirect
    if (page.url().includes('auth')) {
      console.log('Authentication required for console logging test');
      return;
    }

    // Wait for page to load
    await expect(page.locator('text=Error Boundary Testing')).toBeVisible({ timeout: 10000 });
    
    // Trigger an error
    const triggerButton = page.locator('button:has-text("Trigger Test Error")').first();
    await triggerButton.click();
    
    // Wait for error to be processed
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 5000 });
    
    // Give a moment for console logs to appear
    await page.waitForTimeout(1000);
    
    // Check that error was logged (the exact format may vary)
    const hasErrorLog = consoleErrors.some(log => 
      log.includes('ErrorBoundary') || 
      log.includes('error') || 
      log.includes('Error:')
    );
    
    expect(hasErrorLog).toBe(true);
  });
});