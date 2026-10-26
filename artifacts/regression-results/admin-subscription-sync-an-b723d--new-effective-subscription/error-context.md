# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-subscription-sync.spec.ts >> an administrator sees success only after the server confirms the new effective subscription
- Location: tests\admin-subscription-sync.spec.ts:68:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByTitle('Change Plan')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [aria-hidden] [ref=e14]: "0"
          - generic [ref=e15]: "1"
        - generic [ref=e16]: Issue
      - button "Collapse issues badge" [ref=e17]
  - paragraph [ref=e23]: Verifying Super Admin Authorization...
  - alert [ref=e24]
```

# Test source

```ts
  1   | import { expect, test, type Page, type Route } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * An administrator's subscription change must be confirmed by the server
  5   |  * before the portal reports success, and the member's app must pick up the
  6   |  * workspace's new effective subscription without stale state.
  7   |  */
  8   | 
  9   | const workspaceId = '65f000000000000000000001';
  10  | 
  11  | const corsHeaders = (route: Route) => ({
  12  |   'access-control-allow-origin': route.request().headers().origin ?? 'http://127.0.0.1:3101',
  13  |   'access-control-allow-credentials': 'true',
  14  |   'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  15  |   'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
  16  | });
  17  | 
  18  | async function json(route: Route, body: unknown, status = 200) {
  19  |   await route.fulfill({ status, headers: corsHeaders(route), contentType: 'application/json', body: JSON.stringify(body) });
  20  | }
  21  | 
  22  | const expiredSummary = { status: 'expired', plan: 'starter', hasActiveAccess: false, accessSource: 'none', expiresAt: null };
  23  | const grantedSummary = { status: 'active', plan: 'pro', hasActiveAccess: true, accessSource: 'manual_grant', expiresAt: null };
  24  | 
  25  | async function openAdminWorkspaces(page: Page, onPlanChange: (route: Route) => Promise<void>) {
  26  |   const state = { listRequests: 0, planChanges: [] as unknown[] };
  27  |   await page.addInitScript(() => {
  28  |     localStorage.setItem('workgrind_super_admin_token', 'playwright-admin-token');
  29  |     localStorage.setItem('workgrind_super_admin_user', JSON.stringify({
  30  |       _id: 'playwright-admin', fullName: 'Platform Admin', email: 'admin@example.invalid', role: 'owner', isSuperAdmin: true,
  31  |     }));
  32  |   });
  33  |   await page.route('**/api/**', async (route) => {
  34  |     const request = route.request();
  35  |     const { pathname } = new URL(request.url());
  36  |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders(route) });
  37  |     if (pathname.endsWith('/super-admin/auth/me')) {
  38  |       return json(route, { success: true, admin: { _id: 'playwright-admin', fullName: 'Platform Admin', email: 'admin@example.invalid', role: 'owner', isSuperAdmin: true } });
  39  |     }
  40  |     if (pathname.endsWith('/super-admin/workspaces')) {
  41  |       state.listRequests += 1;
  42  |       return json(route, {
  43  |         success: true, total: 1, totalPages: 1,
  44  |         workspaces: [{
  45  |           _id: workspaceId, name: 'Expired Agency', membersCount: 3, projectsCount: 1,
  46  |           ownerId: { fullName: 'Owner Person', email: 'owner@example.invalid' },
  47  |           subscription: { status: 'expired', plan: 'starter', limits: { members: 0, storage: 0, aiRequests: 0 } },
  48  |           usage: { storageBytes: 0, aiRequests: 0 }, createdAt: '2026-01-01T00:00:00.000Z',
  49  |         }],
  50  |       });
  51  |     }
  52  |     if (pathname.endsWith(`/super-admin/workspaces/${workspaceId}/plans`)) {
  53  |       return json(route, { success: true, plans: ['starter', 'pro', 'free'], subscription: expiredSummary });
  54  |     }
  55  |     if (pathname.endsWith(`/super-admin/workspaces/${workspaceId}/plan`) && request.method() === 'PATCH') {
  56  |       state.planChanges.push(request.postDataJSON());
  57  |       return onPlanChange(route);
  58  |     }
  59  |     return json(route, { success: true, counts: { unread: 0 } });
  60  |   });
  61  |   await page.goto('/admin-portal/workspaces');
> 62  |   await page.getByTitle('Change Plan').click();
      |                                        ^ Error: locator.click: Test timeout of 60000ms exceeded.
  63  |   const dialog = page.getByRole('dialog', { name: 'Workspace subscription' });
  64  |   await expect(dialog).toContainText('currently: No active access (expired)');
  65  |   return { state, dialog };
  66  | }
  67  | 
  68  | test('an administrator sees success only after the server confirms the new effective subscription', async ({ page }) => {
  69  |   const { state, dialog } = await openAdminWorkspaces(page, (route) => json(route, {
  70  |     success: true, previous: expiredSummary, subscription: grantedSummary,
  71  |   }));
  72  | 
  73  |   await dialog.getByRole('radio', { name: 'Pro' }).check();
  74  |   await dialog.getByLabel('Reason (recorded in the audit log)').fill('Support credit');
  75  |   const listRequestsBeforeSave = state.listRequests;
  76  |   await dialog.getByRole('button', { name: 'Save' }).click();
  77  | 
  78  |   await expect(dialog.getByRole('status')).toHaveText('Saved. Members now see: Pro · granted by an administrator');
  79  |   expect(state.planChanges).toEqual([{ plan: 'pro', reason: 'Support credit' }]);
  80  |   // The list reloads so the table shows the confirmed state too.
  81  |   await expect.poll(() => state.listRequests).toBeGreaterThan(listRequestsBeforeSave);
  82  | });
  83  | 
  84  | test('a rejected subscription change shows the server error and no success message', async ({ page }) => {
  85  |   const { dialog } = await openAdminWorkspaces(page, (route) => json(route, {
  86  |     success: false, code: 'PLAN_NOT_ALLOWED', message: 'This business workspace can be given: starter, pro, free.',
  87  |   }, 400));
  88  | 
  89  |   await dialog.getByRole('button', { name: 'Save' }).click();
  90  | 
  91  |   await expect(dialog.getByRole('alert')).toHaveText('This business workspace can be given: starter, pro, free.');
  92  |   await expect(dialog.getByRole('status')).toHaveCount(0);
  93  | });
  94  | 
  95  | test('a session without super-admin rights is sent to the admin login instead of changing the subscription', async ({ page }) => {
  96  |   const { dialog } = await openAdminWorkspaces(page, (route) => json(route, { success: false, message: 'Super admin access required' }, 403));
  97  | 
  98  |   await dialog.getByRole('button', { name: 'Save' }).click();
  99  | 
  100 |   await expect(page).toHaveURL(/\/admin-portal\/login/);
  101 |   await expect(page.getByText('Saved. Members now see')).toHaveCount(0);
  102 | });
  103 | 
  104 | const entitlements = {
  105 |   crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  106 |   fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
  107 | };
  108 | 
  109 | function memberSubscription(active: boolean) {
  110 |   return active
  111 |     ? {
  112 |       status: 'active', plan: 'pro', planName: 'Pro', priceDisplay: '$29/month', hasActiveAccess: true,
  113 |       trialDaysRemaining: null, cancelAtPeriodEnd: false, accessSource: 'manual_grant', entitlements,
  114 |       limits: { members: 25, storage: 10_000_000_000, aiRequests: 500 },
  115 |       usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
  116 |     }
  117 |     : {
  118 |       status: 'expired', plan: 'starter', planName: 'Starter', priceDisplay: '$9/month', hasActiveAccess: false,
  119 |       trialDaysRemaining: null, cancelAtPeriodEnd: false, accessSource: 'none',
  120 |       entitlements: Object.fromEntries(Object.keys(entitlements).map((key) => [key, false])),
  121 |       limits: { members: 0, storage: 0, aiRequests: 0 },
  122 |       usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
  123 |     };
  124 | }
  125 | 
  126 | async function signInMember(page: Page, workspace: { active: boolean }) {
  127 |   const statusRequests: number[] = [];
  128 |   await page.routeWebSocket('**/socket.io/**', (socket) => {
  129 |     socket.close({ code: 1000, reason: 'Socket.IO is not under test.' });
  130 |   });
  131 |   await page.addInitScript(() => {
  132 |     sessionStorage.setItem('workgrind_access_token', 'playwright-member-access');
  133 |     sessionStorage.setItem('workgrind_refresh_token', 'playwright-member-refresh');
  134 |   });
  135 |   await page.route('**/api/**', async (route) => {
  136 |     const request = route.request();
  137 |     const { pathname } = new URL(request.url());
  138 |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders(route) });
  139 |     if (pathname.endsWith('/auth/me')) {
  140 |       return json(route, {
  141 |         success: true,
  142 |         user: {
  143 |           _id: 'playwright-member', fullName: 'Workspace Member', email: 'member@example.invalid', role: 'owner',
  144 |           companyId: { _id: workspaceId, name: 'Expired Agency', organizationType: 'business', accountType: 'company' },
  145 |           theme: 'light', preferredLanguage: 'en',
  146 |         },
  147 |       });
  148 |     }
  149 |     if (pathname.endsWith('/subscription/status')) {
  150 |       statusRequests.push(Date.now());
  151 |       return json(route, { success: true, source: 'company', subscription: memberSubscription(workspace.active) });
  152 |     }
  153 |     if (pathname.endsWith('/subscription/plans')) return json(route, { success: true, plans: [] });
  154 |     return json(route, { success: true, data: [], items: [], members: [], notifications: [], tasks: [], projects: [] });
  155 |   });
  156 |   return statusRequests;
  157 | }
  158 | 
  159 | test('a member whose workspace is granted access leaves the expired screen without reloading and stays active after refresh', async ({ page }) => {
  160 |   const workspace = { active: false };
  161 |   await page.clock.install();
  162 |   const statusRequests = await signInMember(page, workspace);
```