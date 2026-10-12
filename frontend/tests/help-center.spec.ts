import { expect, test } from '@playwright/test';
import { HELP_ARTICLES } from '../src/lib/helpArticles';

test('Help Center and published articles are readable without authentication', async ({ page }) => {
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search help articles' })).toBeVisible();

  await page.goto('/help/getting-started');
  await expect(page.getByRole('heading', { name: 'Create an account and set up your workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Symptoms' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Likely causes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Steps to try' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verify the fix' })).toBeVisible();
});

test('Help search matches feature and payment-provider keywords', async ({ page }) => {
  await page.goto('/help');
  await page.getByRole('textbox', { name: 'Search help articles' }).fill('Polar');
  await expect(page.getByRole('link', { name: /Fix checkout, payment, and cancellation problems/ })).toBeVisible();
  await expect(page.getByText(/matching “Polar”/)).toBeVisible();
});

test('protected destinations show a sign-in prompt with a safe return URL', async ({ page }) => {
  await page.goto('/help/tasks-and-projects');
  const signIn = page.getByRole('link', { name: /Sign in to continue/ });
  await expect(signIn).toHaveAttribute('href', '/login?redirect=%2Ftasks');
  await signIn.click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
  await expect(page.getByRole('heading', { name: 'Good to have you back.' })).toBeVisible();
});

test('a direct protected-route visit preserves the requested path through sign-in', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
});

test('successful sign-in returns an existing member to the requested destination', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        accessToken: 'help-test-access',
        user: {
          _id: 'help-test-user',
          fullName: 'Help Test',
          email: 'help-test@example.invalid',
          role: 'owner',
          companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
        },
      }),
    });
  });
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: {
          _id: 'help-test-user',
          fullName: 'Help Test',
          email: 'help-test@example.invalid',
          role: 'owner',
          companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
        },
      }),
    });
  });
  await page.route('**/subscription/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        subscription: {
          status: 'trialing',
          hasActiveAccess: true,
          organizationType: 'business',
          entitlements: { tasksProjects: true },
          limits: { members: 5, storage: 1_000_000, aiRequests: 50 },
          usage: { members: 1, storageBytes: 0, aiRequests: 0 },
        },
      }),
    });
  });

  await page.goto('/login?redirect=%2Ftasks');
  await page.getByLabel('Work email').fill('help-test@example.invalid');
  await page.getByLabel('Password').fill('not-a-real-secret');
  await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test('every published article has a public route', async ({ request, baseURL }) => {
  for (const article of HELP_ARTICLES) {
    const response = await request.get(`${baseURL}/help/${article.slug}`);
    expect(response.status(), `${article.slug} should be publicly readable`).toBe(200);
  }
});
