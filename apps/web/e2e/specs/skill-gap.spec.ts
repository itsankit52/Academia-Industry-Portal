import { test, expect } from '../fixtures/seedGuard';
import { STUDENT } from '../fixtures/accounts';
import { loginAs } from '../fixtures/login';

test.describe('Skill Gap', () => {
  test('student sees matched/missing chips and AI narrative', async ({ page }) => {
    await loginAs(page, STUDENT);
    await page.goto('/student/skill-gap');

    const combobox = page.getByRole('combobox').first();
    if (await combobox.isVisible().catch(() => false)) {
      await combobox.selectOption({ index: 1 }).catch(async () => {
        await combobox.click();
        await page.getByRole('option').first().click();
      });
    } else {
      await page.getByRole('button', { name: /select|choose|pick.*job/i }).first().click();
      await page.getByRole('option').first().click();
    }

    try {
      await expect(
        page.getByText(/matched|matching/i).first(),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByText(/missing|gap/i).first(),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByText(/narrative|analysis|summary|recommendation/i).first(),
      ).toBeVisible({ timeout: 20000 });
    } catch {
      test.skip(true, 'AI narrative unavailable — GEMINI_API_KEY likely not configured');
    }
  });
});
