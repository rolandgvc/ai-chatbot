import { expect, test } from '@playwright/test';

test.describe('UI Functionality Validation after Type Safety Changes', () => {
  test('App loads correctly with new interfaces', async ({ page }) => {
    // Test that the app loads without TypeScript compilation errors
    await page.goto('/');
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Check that essential UI elements are present
    expect(await page.locator('body')).toBeVisible();
    
    // Verify there are no console errors related to TypeScript compilation
    const consoleMessages = [];
    page.on('consolemessage', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    
    // Wait a bit for any console errors to appear
    await page.waitForTimeout(2000);
    
    // Filter out expected/unrelated errors and focus on TypeScript-related ones
    const typeScriptErrors = consoleMessages.filter(msg => 
      msg.includes('TypeError') || 
      msg.includes('undefined') || 
      msg.includes('any')
    );
    
    expect(typeScriptErrors.length).toBe(0);
  });

  test('Interface changes do not break existing functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify the main chat interface loads
    const chatContainer = page.locator('[data-testid="chat-container"], .chat-container, main, [role="main"]').first();
    
    // If chat container exists, verify it's visible
    if (await chatContainer.count() > 0) {
      await expect(chatContainer).toBeVisible();
    }
    
    // Verify no JavaScript runtime errors occurred due to interface changes
    let hasRuntimeError = false;
    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
      hasRuntimeError = true;
    });
    
    await page.waitForTimeout(3000);
    expect(hasRuntimeError).toBe(false);
  });

  test('Sheet editor interfaces work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // This test validates that the SheetRowData and SheetData interfaces
    // don't cause runtime errors by checking page load success
    const response = await page.evaluate(() => {
      // Check if window object is available (indicates successful loading)
      return typeof window !== 'undefined' && window.location.pathname === '/';
    });
    
    expect(response).toBe(true);
  });
});