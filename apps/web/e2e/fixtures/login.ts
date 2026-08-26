import type { Page } from '@playwright/test';
import type { Credentials } from './accounts';

export async function loginAs(page: Page, { email, password }: Credentials): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

export async function logout(page: Page): Promise<void> {
  const logoutButton = page.getByRole('button', { name: /log ?out|sign out/i }).first();
  await logoutButton.click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
}
