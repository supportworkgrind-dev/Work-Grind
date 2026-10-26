# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: help-center.spec.ts >> Help Center and published articles are readable without authentication
- Location: tests\help-center.spec.ts:5:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://127.0.0.1:3101/help/getting-started", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { getSafeReturnPath, getWorkspaceSetupDestination } from '../src/lib/authRedirect';
  3   | import { HELP_ARTICLES } from '../src/lib/helpArticles';
  4   | 
  5   | test('Help Center and published articles are readable without authentication', async ({ page }) => {
  6   |   await page.goto('/help');
  7   |   await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
  8   |   await expect(page.getByRole('searchbox', { name: 'Search help articles' })).toBeVisible();
  9   | 
> 10  |   await page.goto('/help/getting-started');
      |              ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  11  |   await expect(page.getByRole('heading', { name: 'Create an account and set up your workspace' })).toBeVisible();
  12  |   await expect(page.getByRole('heading', { name: 'Symptoms' })).toBeVisible();
  13  |   await expect(page.getByRole('heading', { name: 'Likely causes' })).toBeVisible();
  14  |   await expect(page.getByRole('heading', { name: 'Steps to try' })).toBeVisible();
  15  |   await expect(page.getByRole('heading', { name: 'Verify the fix' })).toBeVisible();
  16  | });
  17  | 
  18  | test('Help search matches feature and payment-provider keywords', async ({ page }) => {
  19  |   await page.goto('/help');
  20  |   await page.getByRole('searchbox', { name: 'Search help articles' }).fill('Polar');
  21  |   await expect(page.getByRole('link', { name: /Fix checkout, payment, and cancellation problems/ })).toBeVisible();
  22  |   await expect(page.getByText(/matching “Polar”/)).toBeVisible();
  23  | });
  24  | 
  25  | test('the help index remains usable at a narrow mobile viewport', async ({ page }) => {
  26  |   await page.setViewportSize({ width: 390, height: 844 });
  27  |   await page.goto('/help');
  28  |   await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
  29  |   await expect(page.getByRole('searchbox', { name: 'Search help articles' })).toBeVisible();
  30  |   const widths = await page.evaluate(() => ({
  31  |     viewport: document.documentElement.clientWidth,
  32  |     content: document.documentElement.scrollWidth,
  33  |   }));
  34  |   expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  35  | });
  36  | 
  37  | test('return URLs reject external and protocol-relative destinations', () => {
  38  |   expect(getSafeReturnPath('/tasks?filter=mine')).toBe('/tasks?filter=mine');
  39  |   expect(getSafeReturnPath('https://example.com')).toBeUndefined();
  40  |   expect(getSafeReturnPath('//example.com')).toBeUndefined();
  41  |   expect(getSafeReturnPath('/\\\\example.com')).toBeUndefined();
  42  |   expect(getSafeReturnPath('/login?redirect=%2Ftasks')).toBeUndefined();
  43  |   expect(getWorkspaceSetupDestination('/tasks')).toBe('/create-company?redirect=%2Ftasks');
  44  |   expect(getWorkspaceSetupDestination('/create-company')).toBe('/create-company');
  45  | });
  46  | 
  47  | test('protected destinations show a sign-in prompt with a safe return URL', async ({ page }) => {
  48  |   await page.goto('/help/tasks-and-projects');
  49  |   const signIn = page.getByRole('link', { name: /Sign in to continue/ });
  50  |   await expect(signIn).toHaveAttribute('href', '/login?redirect=%2Ftasks');
  51  |   await signIn.click();
  52  |   await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
  53  |   await expect(page.getByRole('heading', { name: 'Good to have you back.' })).toBeVisible();
  54  | });
  55  | 
  56  | test('a direct protected-route visit preserves the requested path through sign-in', async ({ page }) => {
  57  |   await page.goto('/tasks');
  58  |   await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
  59  | });
  60  | 
  61  | test('successful sign-in returns an existing member to the requested destination', async ({ page }) => {
  62  |   await page.route('**/auth/login', async (route) => {
  63  |     await route.fulfill({
  64  |       status: 200,
  65  |       contentType: 'application/json',
  66  |       body: JSON.stringify({
  67  |         success: true,
  68  |         accessToken: 'help-test-access',
  69  |         user: {
  70  |           _id: 'help-test-user',
  71  |           fullName: 'Help Test',
  72  |           email: 'help-test@example.invalid',
  73  |           role: 'owner',
  74  |           companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
  75  |         },
  76  |       }),
  77  |     });
  78  |   });
  79  |   await page.route('**/auth/me', async (route) => {
  80  |     await route.fulfill({
  81  |       status: 200,
  82  |       contentType: 'application/json',
  83  |       body: JSON.stringify({
  84  |         success: true,
  85  |         user: {
  86  |           _id: 'help-test-user',
  87  |           fullName: 'Help Test',
  88  |           email: 'help-test@example.invalid',
  89  |           role: 'owner',
  90  |           companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
  91  |         },
  92  |       }),
  93  |     });
  94  |   });
  95  |   await page.route('**/subscription/status', async (route) => {
  96  |     await route.fulfill({
  97  |       status: 200,
  98  |       contentType: 'application/json',
  99  |       body: JSON.stringify({
  100 |         success: true,
  101 |         subscription: {
  102 |           status: 'trialing',
  103 |           hasActiveAccess: true,
  104 |           organizationType: 'business',
  105 |           entitlements: { tasksProjects: true },
  106 |           limits: { members: 5, storage: 1_000_000, aiRequests: 50 },
  107 |           usage: { members: 1, storageBytes: 0, aiRequests: 0 },
  108 |         },
  109 |       }),
  110 |     });
```