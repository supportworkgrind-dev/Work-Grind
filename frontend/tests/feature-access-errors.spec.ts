import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * "This feature is not available for your organization or role." must only
 * appear for a genuine refusal, never with a Retry button, and recoverable
 * failures must not be shown as an empty or "all clear" state. The API is
 * mocked with isolated fixtures; no production records are used.
 */

type Workspace = { organizationType?: string; accountType?: string; role: string };
type Handler = (route: Route) => Promise<void> | void;

const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

const headersFor = (route: Route) => ({
  'access-control-allow-origin': route.request().headers().origin ?? 'http://127.0.0.1:3101',
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
});
const reply = (route: Route, status: number, payload: unknown) =>
  route.fulfill({ status, headers: headersFor(route), contentType: 'application/json', body: JSON.stringify(payload) });

const FORBIDDEN = { success: false, code: 'ORGANIZATION_FEATURE_FORBIDDEN', message: 'This feature is not available for your organization or role.' };

async function signIn(page: Page, workspace: Workspace, overrides: Record<string, Handler> = {}) {
  await page.addInitScript(() => sessionStorage.setItem('workgrind_access_token', 'playwright-feature-access'));
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO is not under test.' }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: headersFor(route) });
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const override = overrides[`${request.method()} ${pathname}`];
    if (override) return override(route);
    if (pathname === '/auth/me') {
      const company: Record<string, unknown> = { _id: 'feature-company', name: 'Fixture Workspace', ownerId: 'feature-user' };
      if (workspace.organizationType !== undefined) company.organizationType = workspace.organizationType;
      if (workspace.accountType !== undefined) company.accountType = workspace.accountType;
      return reply(route, 200, {
        success: true,
        user: { _id: 'feature-user', fullName: 'Fixture User', email: 'fixture@example.invalid', role: workspace.role, companyId: company, theme: 'light', preferredLanguage: 'en' },
      });
    }
    if (pathname === '/subscription/status') {
      return reply(route, 200, {
        success: true,
        source: 'company',
        subscription: {
          status: 'active', plan: 'pro', planName: 'Pro', hasActiveAccess: true, trialDaysRemaining: null, cancelAtPeriodEnd: false,
          entitlements, limits: { members: 100, storage: 1, aiRequests: 100 },
          usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    if (pathname === '/daily-focus') {
      return reply(route, 200, { success: true, data: { focusItems: [], isAllClear: true, summary: '', generatedAt: new Date().toISOString(), stats: {} } });
    }
    if (pathname === '/ai/agent/history') return reply(route, 200, { success: true, conversations: [] });
    return reply(route, 200, { success: true });
  });
}

const dailyFocusLink = (page: Page) => page.getByRole('link', { name: 'Daily Focus' }).first();

test('a Solo owner can open Daily Focus, which the API now serves', async ({ page }) => {
  await signIn(page, { organizationType: 'business', accountType: 'individual', role: 'owner' });
  await page.goto('/daily-focus');
  await expect(page).toHaveURL(/\/daily-focus$/);
  await expect(page.getByText('This feature is not available for your organization or role.')).toHaveCount(0);
});

test('a business team member can follow the dashboard card to Daily Focus', async ({ page }) => {
  await signIn(page, { organizationType: 'business', accountType: 'company', role: 'employee' });
  await page.goto('/daily-focus');
  await expect(page).toHaveURL(/\/daily-focus$/);
});

test('a workspace saved without organization or account type is treated as a business team', async ({ page }) => {
  await signIn(page, { role: 'employee' });
  await page.goto('/daily-focus');
  await expect(page).toHaveURL(/\/daily-focus$/);
  await expect(dailyFocusLink(page)).toBeVisible();
});

test('education workspaces are not offered Daily Focus', async ({ page }) => {
  await signIn(page, { organizationType: 'school', accountType: 'company', role: 'teacher' });
  await page.goto('/daily-focus');
  await expect(page).not.toHaveURL(/\/daily-focus/);
});

test('a refused Daily Focus request shows the reason without Retry or an "all clear" state', async ({ page }) => {
  await signIn(page, { organizationType: 'business', accountType: 'company', role: 'employee' }, {
    'GET /daily-focus': (route) => reply(route, 403, FORBIDDEN),
  });
  await page.goto('/daily-focus');
  await expect(page.getByRole('alert').filter({ hasText: 'not available for your organization or role' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(page.getByText(/No priority action items right now/)).toHaveCount(0);
});

test('a server failure in Daily Focus offers Retry and recovers', async ({ page }) => {
  let attempts = 0;
  await signIn(page, { organizationType: 'business', accountType: 'company', role: 'employee' }, {
    'GET /daily-focus': (route) => {
      attempts += 1;
      return attempts === 1
        ? reply(route, 503, { success: false, message: 'Daily Focus is temporarily unavailable.' })
        : reply(route, 200, { success: true, data: { focusItems: [], isAllClear: true, summary: '', generatedAt: new Date().toISOString(), stats: {} } });
    },
  });
  await page.goto('/daily-focus');
  await expect(page.getByRole('alert').filter({ hasText: 'Daily Focus is temporarily unavailable.' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText(/No priority action items right now/)).toBeVisible();
  expect(attempts).toBe(2);
});

test('Tavro shows a permission refusal without offering Retry', async ({ page }) => {
  await signIn(page, { organizationType: 'business', accountType: 'company', role: 'employee' }, {
    'POST /ai/agent': (route) => reply(route, 403, FORBIDDEN),
  });
  await page.goto('/ai');
  const input = page.getByPlaceholder(/Ask me to find tasks/);
  await input.fill('What is due today?');
  await input.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'not available for your organization or role' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('Tavro offers Retry for a recoverable server error', async ({ page }) => {
  await signIn(page, { organizationType: 'business', accountType: 'company', role: 'employee' }, {
    'POST /ai/agent': (route) => reply(route, 502, { success: false, message: 'Tavro AI is temporarily unavailable.' }),
  });
  await page.goto('/ai');
  const input = page.getByPlaceholder(/Ask me to find tasks/);
  await input.fill('What is due today?');
  await input.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Tavro AI is temporarily unavailable.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
