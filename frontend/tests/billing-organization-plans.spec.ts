import { expect, test, type Page, type Route } from '@playwright/test';

type OrgType = 'business' | 'school' | 'college' | 'university';

const entitlements = {
  crm: false, tasksProjects: false, teamChat: false, meetingsCalendar: false,
  fileStorage: false, aiAssistant: false, prioritySupport: false, advancedAnalytics: false,
};

const businessPlans = [
  { id: 'free', name: 'Free Trial', priceDisplay: '$0', highlighted: false },
  { id: 'starter', name: 'Starter', priceDisplay: '$9/mo', highlighted: false },
  { id: 'pro', name: 'Pro', priceDisplay: '$19/mo', highlighted: true, badgeLabel: 'Most Popular' },
].map((plan) => ({
  ...plan,
  priceMonthly: 0,
  description: 'Business plan',
  entitlements,
  limits: { members: 5, storage: 0, aiRequests: 0 },
  features: [{ label: 'Tasks & Projects', included: true }],
}));

const educationPlans = [
  { id: 'school', name: 'WorkGrind School', priceDisplay: '$19/month', limits: { members: 25, students: 200, pendingInvites: 50 } },
  { id: 'college', name: 'WorkGrind College', priceDisplay: '$49/month', limits: { members: 75, students: 750, pendingInvites: 150 } },
  { id: 'university', name: 'WorkGrind University', priceDisplay: '$99/month', limits: { members: 200, students: 2000, pendingInvites: 500 } },
].map((plan) => ({
  ...plan,
  priceMonthly: 0,
  billingInterval: 'month',
  currency: 'USD',
  description: `Monthly subscription for ${plan.id}s.`,
  checkoutAvailable: true,
}));

const availablePlanIds: Record<OrgType, string[]> = {
  business: ['starter', 'pro'], school: ['school'], college: ['college'], university: ['university'],
};

async function mockExpiredWorkspace(
  page: Page,
  organizationType: string,
  options: { educationPlansResponse?: unknown[]; checkoutRequests?: string[] } = {},
) {
  await page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'playwright-billing-access');
    sessionStorage.setItem('workgrind_refresh_token', 'playwright-billing-refresh');
  });
  const normalized = organizationType.trim().toLowerCase() as OrgType;
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? 'http://127.0.0.1:3101',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (pathname.endsWith('/auth/me')) {
      return json({
        success: true,
        user: {
          _id: 'billing-user', fullName: 'Billing Owner', email: 'owner@example.invalid', role: 'owner',
          companyId: { _id: 'billing-company', name: 'testinguni', organizationType, accountType: 'company' },
          theme: 'light', preferredLanguage: 'en',
        },
      });
    }
    if (pathname.endsWith('/auth/refresh')) return json({ success: true, accessToken: 'playwright-billing-access' });
    if (pathname.endsWith('/subscription/status')) {
      return json({
        success: true,
        source: 'company',
        subscription: {
          status: 'expired',
          plan: normalized === 'business' ? 'starter' : normalized,
          organizationType,
          availablePlanIds: availablePlanIds[normalized] ?? [],
          accountType: 'company',
          planName: normalized === 'business' ? 'Starter' : `WorkGrind ${normalized[0].toUpperCase()}${normalized.slice(1)}`,
          priceDisplay: 'No paid subscription',
          hasActiveAccess: false,
          trialDaysRemaining: null,
          cancelAtPeriodEnd: false,
          entitlements,
          limits: { members: 0, storage: 0, aiRequests: 0 },
          usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    if (pathname.endsWith('/subscription/plans')) {
      return json({ success: true, plans: businessPlans, educationPlans: options.educationPlansResponse ?? educationPlans });
    }
    if (pathname.endsWith('/subscription/checkout')) {
      options.checkoutRequests?.push((request.postDataJSON() as { planId: string }).planId);
      return json({ success: false, message: 'Checkout intercepted by test.' }, 400);
    }
    return json({ success: true });
  });
}

const plansSection = (page: Page) => page.locator('#expired-plans');

test('expired University workspace (testinguni) shows only the University plan', async ({ page }) => {
  const checkoutRequests: string[] = [];
  await mockExpiredWorkspace(page, 'University', { checkoutRequests });
  await page.goto('/billing');

  const section = plansSection(page);
  await expect(section.getByText('WorkGrind University', { exact: true })).toBeVisible();
  await expect(section.getByText('$99/month')).toBeVisible();
  for (const hidden of ['Starter', 'Pro', 'WorkGrind School', 'WorkGrind College']) {
    await expect(section.getByText(hidden, { exact: true })).toHaveCount(0);
  }
  await expect(section.getByRole('button')).toHaveCount(1);

  await section.getByRole('button', { name: 'Choose WorkGrind University' }).click();
  await expect.poll(() => checkoutRequests).toEqual(['university']);
});

for (const type of ['school', 'college'] as const) {
  test(`expired ${type} workspace shows only its own education plan`, async ({ page }) => {
    await mockExpiredWorkspace(page, type);
    await page.goto('/billing');
    const section = plansSection(page);
    const name = `WorkGrind ${type[0].toUpperCase()}${type.slice(1)}`;
    await expect(section.getByText(name, { exact: true })).toBeVisible();
    await expect(section.getByRole('button')).toHaveCount(1);
    await expect(section.getByText('Starter', { exact: true })).toHaveCount(0);
    await expect(section.getByText('WorkGrind University', { exact: true })).toHaveCount(0);
  });
}

test('expired business workspace still shows Starter and Pro only', async ({ page }) => {
  await mockExpiredWorkspace(page, 'business');
  await page.goto('/billing');
  const section = plansSection(page);
  await expect(section.getByText('Starter', { exact: true })).toBeVisible();
  await expect(section.getByText('Pro', { exact: true })).toBeVisible();
  await expect(section.getByText(/WorkGrind (School|College|University)/)).toHaveCount(0);
});

test('missing University pricing shows an error instead of falling back to business plans', async ({ page }) => {
  await mockExpiredWorkspace(page, 'university', { educationPlansResponse: [] });
  await page.goto('/billing');
  const section = plansSection(page);
  await expect(section.getByRole('alert')).toContainText('University plan pricing could not be loaded');
  await expect(section.getByText('Starter', { exact: true })).toHaveCount(0);
  await expect(section.getByRole('button')).toHaveCount(0);
});
