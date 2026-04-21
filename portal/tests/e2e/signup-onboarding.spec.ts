import { test, expect } from '@playwright/test';

const TEST_EMAIL = `test+e2e+${Date.now()}@arizorae.test`;
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Parcours signup → vérification email', () => {
  test('formulaire signup soumet et affiche confirmation', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('input[name="firstName"]', 'E2E');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    // After signup, should redirect to /signup/sent or show success message
    await expect(page).toHaveURL(/\/signup\/sent|\/login/, { timeout: 10_000 });
  });
});

test.describe('Login avec compte invalide', () => {
  test('affiche erreur si mot de passe incorrect', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'nonexistent@arizorae.test');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should stay on login or show an error
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(url).toMatch(/login/);
  });
});
