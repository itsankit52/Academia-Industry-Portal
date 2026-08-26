import { test, expect } from '../fixtures/seedGuard';
import { ADMIN } from '../fixtures/accounts';
import { loginAs } from '../fixtures/login';

test.describe('Admin management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
  });

  test('admin dashboard shows stats', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin/);
    await expect(
      page.getByText(/students|companies|jobs|applications/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Students and Audit Logs pages render tables', async ({ page }) => {
    await page.goto('/admin/students');
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10000 });

    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10000 });
  });
});
