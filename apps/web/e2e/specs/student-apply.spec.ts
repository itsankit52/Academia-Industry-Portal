import { test, expect } from '../fixtures/seedGuard';
import { STUDENT } from '../fixtures/accounts';
import { loginAs } from '../fixtures/login';

test.describe('Student application flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, STUDENT);
  });

  test('student applies to a job and sees success toast', async ({ page }) => {
    await page.goto('/student/jobs');
    await expect(page.getByText(/match/i).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('link', { name: /view|details|open/i }).first().click();
    await expect(page).toHaveURL(/\/student\/jobs\/[^/]+/);

    await page.getByRole('button', { name: /^apply$/i }).click();
    await page
      .getByLabel(/cover letter/i)
      .fill('I am excited to contribute and grow with the team.');
    await page.getByRole('button', { name: /submit|send application|apply now/i }).click();

    await expect(
      page.getByText(/applied|submitted|success/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('application appears in My Applications with APPLIED status', async ({ page }) => {
    await page.goto('/student/applications');
    await expect(page.getByRole('table').or(page.getByRole('list')).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/applied/i).first()).toBeVisible();
  });
});
