import { test, expect } from '../fixtures/seedGuard';
import { STUDENT } from '../fixtures/accounts';
import { loginAs, logout } from '../fixtures/login';

test.describe('Auth', () => {
  test('guest sees landing page with Login and Register CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('link', { name: /log ?in|sign in/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /register|sign up|get started/i }).first(),
    ).toBeVisible();
  });

  test('student login redirects to /student dashboard', async ({ page }) => {
    await loginAs(page, STUDENT);
    await expect(page).toHaveURL(/\/student/);
  });

  test('logout returns to /login', async ({ page }) => {
    await loginAs(page, STUDENT);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
