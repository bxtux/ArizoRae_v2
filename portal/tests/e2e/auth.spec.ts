import { test, expect } from '@playwright/test';

test.describe('Landing et auth pages', () => {
  test('landing page se charge', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ArizoRAE/i);
  });

  test('login page accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('signup page accessible', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('reset password page accessible', async ({ page }) => {
    await page.goto('/reset');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('routes protégées redirigent vers /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });
});
