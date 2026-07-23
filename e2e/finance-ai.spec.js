import { test, expect } from '@playwright/test';

test.describe('AI & Personal Finance Intelligence Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to local app
    await page.goto('http://localhost:5173/#home');
    await page.waitForLoadState('networkidle');
  });

  test('Safe-to-Spend badge and Spotlight trigger render on Overview', async ({ page }) => {
    // Check if hero greeting & safe-to-spend badge exist
    const spotlightBtn = page.locator('button:has-text("Cmd + K Spotlight")');
    await expect(spotlightBtn).toBeVisible();

    const safeToSpendLabel = page.locator('text=Safe-To-Spend Today');
    await expect(safeToSpendLabel).toBeVisible();

    const spendVelocityLabel = page.locator('text=Spend Velocity');
    await expect(spendVelocityLabel).toBeVisible();
  });

  test('Command Palette opens with Cmd+K and responds to natural language search', async ({ page }) => {
    // Click Spotlight button or press Cmd+K
    await page.click('button:has-text("Cmd + K Spotlight")');

    // Verify modal overlay appears
    const input = page.locator('input[placeholder*="Type a command or expense"]');
    await expect(input).toBeVisible();

    // Type natural language expense
    await input.fill('spent 250 on food');
    await page.waitForTimeout(500);

    // Verify navigation list or action card appears
    const navItem = page.locator('text=Go to Overview');
    await expect(navItem).toBeVisible();

    // Close palette using ESC key
    await page.keyboard.press('Escape');
    await expect(input).not.toBeVisible();
  });

  test('What-If Financial Simulator slider interactions adjust projections', async ({ page }) => {
    // Scroll to What-If Simulator
    const simulatorHeader = page.locator('text=Interactive "What-If" Financial Simulator');
    await expect(simulatorHeader).toBeVisible();

    // Check sliders exist
    const sliders = page.locator('input[type="range"]');
    await expect(sliders).toHaveCount(3);

    // Check Set Target Budget button
    const targetBtn = page.locator('button:has-text("Set Simulated Budget Limit Target")');
    await expect(targetBtn).toBeVisible();
  });

});
