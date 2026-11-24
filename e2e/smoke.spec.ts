import { expect, test } from '@playwright/test';

// Requires the seeded demo ward (./run.sh setup).
test.skip(
  !!process.env.CI && !process.env.E2E_ENABLED,
  'Browsers are not installed in CI by default',
);

test('scheduler signs in and generates the demo roster', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('scheduler@rostra.test');
  await page.getByLabel('Password').fill('rostra-demo-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();

  await page.getByRole('link', { name: 'Rosters' }).click();
  await page.getByRole('link', { name: /Ward 4B week of/ }).click();
  await page.getByRole('button', { name: 'Generate schedule' }).click();
  await expect(page.getByText('Feasible')).toBeVisible();
  await expect(page.getByRole('table')).toContainText('RN');
});

test('planned sections are visible with a badge', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('scheduler@rostra.test');
  await page.getByLabel('Password').fill('rostra-demo-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: /Payroll/ }).click();
  await expect(page.getByRole('heading', { name: /Payroll/ })).toContainText('Planned');
});
