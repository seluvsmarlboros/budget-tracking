import { test, expect } from '@playwright/test';

test.describe('Circles Hub Overhaul Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/#partner');
    await page.waitForLoadState('networkidle');
  });

  test('Circles view renders header, create circle button, and circle cards', async ({ page }) => {
    const header = page.locator('text=UniSpend Circles');
    await expect(header).toBeVisible();

    const createBtn = page.locator('button:has-text("Create Circle")');
    await expect(createBtn).toBeVisible();

    const joinBtn = page.locator('button:has-text("Join with Code")');
    await expect(joinBtn).toBeVisible();
  });

  test('Create Circle modal opens and submits new circle with initial roommates', async ({ page }) => {
    await page.click('button:has-text("Create Circle")');

    const modalTitle = page.locator('h3:has-text("Create New Circle")');
    await expect(modalTitle).toBeVisible();

    const nameInput = page.locator('input[placeholder*="Apartment 4B"]');
    await nameInput.fill('Beach House 101');

    const roommateInput = page.locator('input[placeholder*="Roommate #1"]');
    await roommateInput.fill('Karan');

    await page.click('button[type="submit"]:has-text("Create Circle")');

    // Verify new circle card appeared
    const newCircleCard = page.locator('h3:has-text("Beach House 101")');
    await expect(newCircleCard).toBeVisible();
  });

});
