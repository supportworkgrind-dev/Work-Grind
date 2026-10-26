# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-organization-plans.spec.ts >> expired University workspace (testinguni) shows only the University plan
- Location: tests\billing-organization-plans.spec.ts:108:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#expired-plans').getByText('WorkGrind University', { exact: true })
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('#expired-plans').getByText('WorkGrind University', { exact: true }) with timeout 15000ms
  - waiting for locator('#expired-plans').getByText('WorkGrind University', { exact: true })
  - Test timeout of 60000ms exceeded.

```

```yaml
- img "WorkGrind"
- alert
```

# Test source

```ts
  14  | ].map((plan) => ({
  15  |   ...plan,
  16  |   priceMonthly: 0,
  17  |   description: 'Business plan',
  18  |   entitlements,
  19  |   limits: { members: 5, storage: 0, aiRequests: 0 },
  20  |   features: [{ label: 'Tasks & Projects', included: true }],
  21  | }));
  22  | 
  23  | const educationPlans = [
  24  |   { id: 'school', name: 'WorkGrind School', priceDisplay: '$19/month', limits: { members: 25, students: 200, pendingInvites: 50 } },
  25  |   { id: 'college', name: 'WorkGrind College', priceDisplay: '$49/month', limits: { members: 75, students: 750, pendingInvites: 150 } },
  26  |   { id: 'university', name: 'WorkGrind University', priceDisplay: '$99/month', limits: { members: 200, students: 2000, pendingInvites: 500 } },
  27  | ].map((plan) => ({
  28  |   ...plan,
  29  |   priceMonthly: 0,
  30  |   billingInterval: 'month',
  31  |   currency: 'USD',
  32  |   description: `Monthly subscription for ${plan.id}s.`,
  33  |   checkoutAvailable: true,
  34  | }));
  35  | 
  36  | const availablePlanIds: Record<OrgType, string[]> = {
  37  |   business: ['starter', 'pro'], school: ['school'], college: ['college'], university: ['university'],
  38  | };
  39  | 
  40  | async function mockExpiredWorkspace(
  41  |   page: Page,
  42  |   organizationType: string,
  43  |   options: { educationPlansResponse?: unknown[]; checkoutRequests?: string[] } = {},
  44  | ) {
  45  |   await page.addInitScript(() => {
  46  |     sessionStorage.setItem('workgrind_access_token', 'playwright-billing-access');
  47  |     sessionStorage.setItem('workgrind_refresh_token', 'playwright-billing-refresh');
  48  |   });
  49  |   const normalized = organizationType.trim().toLowerCase() as OrgType;
  50  |   await page.route('**/api/**', async (route: Route) => {
  51  |     const request = route.request();
  52  |     const pathname = new URL(request.url()).pathname;
  53  |     const headers = {
  54  |       'access-control-allow-origin': request.headers().origin ?? 'http://127.0.0.1:3101',
  55  |       'access-control-allow-credentials': 'true',
  56  |       'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  57  |       'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
  58  |     };
  59  |     const json = (body: unknown, status = 200) =>
  60  |       route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
  61  | 
  62  |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  63  |     if (pathname.endsWith('/auth/me')) {
  64  |       return json({
  65  |         success: true,
  66  |         user: {
  67  |           _id: 'billing-user', fullName: 'Billing Owner', email: 'owner@example.invalid', role: 'owner',
  68  |           companyId: { _id: 'billing-company', name: 'testinguni', organizationType, accountType: 'company' },
  69  |           theme: 'light', preferredLanguage: 'en',
  70  |         },
  71  |       });
  72  |     }
  73  |     if (pathname.endsWith('/auth/refresh')) return json({ success: true, accessToken: 'playwright-billing-access' });
  74  |     if (pathname.endsWith('/subscription/status')) {
  75  |       return json({
  76  |         success: true,
  77  |         source: 'company',
  78  |         subscription: {
  79  |           status: 'expired',
  80  |           plan: normalized === 'business' ? 'starter' : normalized,
  81  |           organizationType,
  82  |           availablePlanIds: availablePlanIds[normalized] ?? [],
  83  |           accountType: 'company',
  84  |           planName: normalized === 'business' ? 'Starter' : `WorkGrind ${normalized[0].toUpperCase()}${normalized.slice(1)}`,
  85  |           priceDisplay: 'No paid subscription',
  86  |           hasActiveAccess: false,
  87  |           trialDaysRemaining: null,
  88  |           cancelAtPeriodEnd: false,
  89  |           entitlements,
  90  |           limits: { members: 0, storage: 0, aiRequests: 0 },
  91  |           usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
  92  |         },
  93  |       });
  94  |     }
  95  |     if (pathname.endsWith('/subscription/plans')) {
  96  |       return json({ success: true, plans: businessPlans, educationPlans: options.educationPlansResponse ?? educationPlans });
  97  |     }
  98  |     if (pathname.endsWith('/subscription/checkout')) {
  99  |       options.checkoutRequests?.push((request.postDataJSON() as { planId: string }).planId);
  100 |       return json({ success: false, message: 'Checkout intercepted by test.' }, 400);
  101 |     }
  102 |     return json({ success: true });
  103 |   });
  104 | }
  105 | 
  106 | const plansSection = (page: Page) => page.locator('#expired-plans');
  107 | 
  108 | test('expired University workspace (testinguni) shows only the University plan', async ({ page }) => {
  109 |   const checkoutRequests: string[] = [];
  110 |   await mockExpiredWorkspace(page, 'University', { checkoutRequests });
  111 |   await page.goto('/billing');
  112 | 
  113 |   const section = plansSection(page);
> 114 |   await expect(section.getByText('WorkGrind University', { exact: true })).toBeVisible();
      |                                                                            ^ Error: expect(locator).toBeVisible() failed
  115 |   await expect(section.getByText('$99/month')).toBeVisible();
  116 |   for (const hidden of ['Starter', 'Pro', 'WorkGrind School', 'WorkGrind College']) {
  117 |     await expect(section.getByText(hidden, { exact: true })).toHaveCount(0);
  118 |   }
  119 |   await expect(section.getByRole('button')).toHaveCount(1);
  120 | 
  121 |   await section.getByRole('button', { name: 'Choose WorkGrind University' }).click();
  122 |   await expect.poll(() => checkoutRequests).toEqual(['university']);
  123 | });
  124 | 
  125 | for (const type of ['school', 'college'] as const) {
  126 |   test(`expired ${type} workspace shows only its own education plan`, async ({ page }) => {
  127 |     await mockExpiredWorkspace(page, type);
  128 |     await page.goto('/billing');
  129 |     const section = plansSection(page);
  130 |     const name = `WorkGrind ${type[0].toUpperCase()}${type.slice(1)}`;
  131 |     await expect(section.getByText(name, { exact: true })).toBeVisible();
  132 |     await expect(section.getByRole('button')).toHaveCount(1);
  133 |     await expect(section.getByText('Starter', { exact: true })).toHaveCount(0);
  134 |     await expect(section.getByText('WorkGrind University', { exact: true })).toHaveCount(0);
  135 |   });
  136 | }
  137 | 
  138 | test('expired business workspace still shows Starter and Pro only', async ({ page }) => {
  139 |   await mockExpiredWorkspace(page, 'business');
  140 |   await page.goto('/billing');
  141 |   const section = plansSection(page);
  142 |   await expect(section.getByText('Starter', { exact: true })).toBeVisible();
  143 |   await expect(section.getByText('Pro', { exact: true })).toBeVisible();
  144 |   await expect(section.getByText(/WorkGrind (School|College|University)/)).toHaveCount(0);
  145 | });
  146 | 
  147 | test('missing University pricing shows an error instead of falling back to business plans', async ({ page }) => {
  148 |   await mockExpiredWorkspace(page, 'university', { educationPlansResponse: [] });
  149 |   await page.goto('/billing');
  150 |   const section = plansSection(page);
  151 |   await expect(section.getByRole('alert')).toContainText('University plan pricing could not be loaded');
  152 |   await expect(section.getByText('Starter', { exact: true })).toHaveCount(0);
  153 |   await expect(section.getByRole('button')).toHaveCount(0);
  154 | });
  155 | 
```