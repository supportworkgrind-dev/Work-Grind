import { expect, test } from '@playwright/test';

const signupUrl = new URL('/signup', process.env.WORKGRIND_BASE_URL || 'http://127.0.0.1:3101').toString();
const workspaceOptions = [
  { id: 'solo', label: 'Solo / Individual' },
  { id: 'business', label: 'Company / Business' },
  { id: 'school', label: 'School / Academy' },
  { id: 'college', label: 'College' },
  { id: 'university', label: 'University' },
];

for (const option of workspaceOptions) {
  test(`${option.label} signup keeps its selection and gates account details`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(signupUrl);

    await expect(page.getByLabel('Your name')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);

    const radio = page.getByRole('radio', { name: new RegExp(option.label) });
    await page.locator(`label[for="signup-workspace-${option.id}"]`).click();
    await expect(radio).toBeChecked();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible();
    await expect(page.getByText(`Creating a ${option.label} account`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`[?&]workspace=${option.id}(&|$)`));
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible();
    await expect(page.getByText(`Creating a ${option.label} account`)).toBeVisible();

    await page.getByRole('button', { name: 'Change' }).click();
    await expect(radio).toBeChecked();
    await expect(page.getByLabel('Your name')).toHaveCount(0);
  });
}

test('signup account choices support keyboard selection and fit desktop and mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(signupUrl);

  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(workspaceOptions.length);
  await radios.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(radios.nth(1)).toBeChecked();

  for (const viewport of [{ width: 1024, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('heading', { name: 'Choose your workspace.' })).toBeVisible();
    const documentWidth = await page.locator('body').evaluate((body) => body.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(viewport.width);
    for (const option of workspaceOptions) {
      await expect(page.getByRole('radio', { name: new RegExp(option.label) })).toBeVisible();
    }
  }
});

for (const provider of ['Google', 'LinkedIn']) {
  test(`${provider} signup sends the selected workspace and restores it after provider cancellation`, async ({ page }) => {
    await page.goto(signupUrl);
    await page.locator('label[for="signup-workspace-school"]').click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    let authorizationUrl: URL | undefined;
    await page.route(`**/auth/oauth/${provider.toLowerCase()}/start*`, async (route) => {
      authorizationUrl = new URL(route.request().url());
      await route.fulfill({
        status: 302,
        headers: {
          location: `${new URL(signupUrl).origin}/signup?workspace=school&step=details&oauth_error=cancelled`,
        },
      });
    });

    await page.getByRole('button', { name: `Continue with ${provider}` }).click();
    await expect(page.locator('.auth-error[role="alert"]')).toContainText('Sign-up was cancelled');
    expect(authorizationUrl?.searchParams.get('intent')).toBe('signup');
    expect(authorizationUrl?.searchParams.get('accountType')).toBe('company');
    expect(authorizationUrl?.searchParams.get('organizationType')).toBe('school');
    await expect(page.getByText('Creating a School / Academy account')).toBeVisible();
  });
}

test('email verification displays signup progress and keeps the workspace when returning', async ({ page }) => {
  await page.goto(`${new URL(signupUrl).origin}/verify-email?email=test@example.com&workspace=university`);

  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  const activeSignupStep = page.locator('.signup-steps li[aria-current="step"]');
  await expect(activeSignupStep).toHaveText(/03.*VERIFY EMAIL/);
  await expect(page.getByText('You’re setting up a University workspace.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to signup' }).click();
  await expect(page).toHaveURL(/\/signup\?workspace=university$/);
  await expect(page.getByRole('radio', { name: /University/ })).toBeChecked();
});

test('email signup validates confirmation and redirects successful registration to verification', async ({ page }) => {
  await page.goto(`${new URL(signupUrl).origin}/signup?workspace=solo&step=details`);

  await page.getByLabel('Your name').fill('Jordan Lee');
  await page.getByLabel('Email address').fill('jordan@example.com');
  await page.getByLabel('Password', { exact: true }).fill('ValidPass1!');
  await page.getByLabel('Confirm password').fill('DifferentPass1!');

  let registrationRequests = 0;
  await page.route('**/auth/register', async (route) => {
    registrationRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.auth-error[role="alert"]')).toContainText('Your passwords do not match');
  expect(registrationRequests).toBe(0);

  await page.getByLabel('Confirm password').fill('ValidPass1!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=jordan%40example\.com&workspace=solo$/);
  expect(registrationRequests).toBe(1);
});
