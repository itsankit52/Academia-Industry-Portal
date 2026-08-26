import { test, expect } from '../fixtures/seedGuard';
import { COMPANY } from '../fixtures/accounts';
import { loginAs } from '../fixtures/login';

test.describe('Company workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, COMPANY);
  });

  test('company creates a job and it appears in Manage Jobs', async ({ page }) => {
    const title = `E2E Job ${Date.now()}`;

    await page.goto('/company/jobs/new');
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/description/i).fill('A great role for talented engineers.');
    await page.getByLabel(/location/i).first().fill('Remote');

    const skillInput = page.getByPlaceholder(/skill|add skill|type a skill/i).first();
    await skillInput.fill('TypeScript');
    await skillInput.press('Enter');
    await skillInput.fill('React');
    await skillInput.press('Enter');

    await page.getByRole('button', { name: /publish|create|save/i }).first().click();

    await page.goto('/company/jobs');
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
  });

  test('company shortlists an applicant', async ({ page }) => {
    await page.goto('/company/applicants');
    await page.getByRole('link', { name: /view|details|open/i }).first().click();
    await page.getByRole('button', { name: /shortlist/i }).click();
    await expect(page.getByText(/shortlisted/i).first()).toBeVisible({ timeout: 10000 });
  });
});
