import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Social Publishing exists only in Business team and Solo workspaces. The API is
 * mocked with isolated fixtures; no production records are used.
 */

type Workspace = {
  organizationType: 'business' | 'school' | 'college' | 'university';
  accountType: 'company' | 'individual';
  role: string;
};

const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

async function signIn(page: Page, workspace: Workspace) {
  const socialRequests: string[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'playwright-social-access');
  });
  await page.routeWebSocket('**/socket.io/**', (socket) => {
    socket.close({ code: 1000, reason: 'Socket.IO is not under test.' });
  });
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? 'http://127.0.0.1:3101',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (payload: unknown) =>
      route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(payload) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (pathname.startsWith('/social-publishing')) socialRequests.push(pathname);

    if (pathname === '/auth/me') {
      return json({
        success: true,
        user: {
          _id: 'social-user', fullName: 'Fixture User', email: 'fixture@example.invalid', role: workspace.role,
          companyId: { _id: 'social-company', name: 'Fixture Workspace', ownerId: 'social-user', ...workspace },
          theme: 'light', preferredLanguage: 'en',
        },
      });
    }
    if (pathname === '/subscription/status') {
      return json({
        success: true,
        source: 'company',
        subscription: {
          status: 'active', plan: 'pro', planName: 'Pro', organizationType: workspace.organizationType,
          accountType: workspace.accountType, hasActiveAccess: true, trialDaysRemaining: null, cancelAtPeriodEnd: false,
          entitlements, limits: { members: 100, storage: 1, aiRequests: 1 },
          usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    if (pathname === '/social-publishing/providers') {
      const capabilities = { connect: true, publishText: true, publishMedia: true, schedule: true, analytics: false, organizationPublishing: false };
      return json({ success: true, providers: [{ id: 'linkedin', name: 'LinkedIn', availability: 'available', capabilities }] });
    }
    if (pathname === '/social-publishing/accounts') return json({ success: true, accounts: [] });
    if (pathname === '/social-publishing/posts') return json({ success: true, posts: [] });
    if (pathname === '/social-publishing/connection') {
      return json({
        success: true,
        connection: { connected: false, status: 'disconnected', identityName: null, identityEmail: null, scopes: [], canPublishMemberPosts: false, expiresAt: null, errorCode: null },
      });
    }
    if (pathname === '/social-publishing/youtube/connection') {
      return json({
        success: true,
        connection: { configured: false, connected: false, status: 'disconnected', channelTitle: null, channelId: null, identityEmail: null, scopes: [], canPublishVideos: false, errorCode: null },
      });
    }
    return json({ success: true });
  });
  return socialRequests;
}

const socialLink = (page: Page) => page.getByRole('link', { name: 'Social Publishing' });

const supported: Array<[string, Workspace]> = [
  ['business owner', { organizationType: 'business', accountType: 'company', role: 'owner' }],
  ['business admin', { organizationType: 'business', accountType: 'company', role: 'admin' }],
  ['business employee', { organizationType: 'business', accountType: 'company', role: 'employee' }],
  ['solo owner', { organizationType: 'business', accountType: 'individual', role: 'owner' }],
];

for (const [label, workspace] of supported) {
  test(`${label} can open Social Publishing from the sidebar`, async ({ page }) => {
    await signIn(page, workspace);
    await page.goto('/settings');
    await expect(socialLink(page)).toBeVisible();
    await socialLink(page).click();
    await expect(page).toHaveURL(/\/social-publishing$/);
    await expect(page.getByRole('heading', { name: 'Social Publishing', level: 1 })).toBeVisible();
  });
}

const unsupported: Array<[string, Workspace]> = [
  ['school owner', { organizationType: 'school', accountType: 'company', role: 'owner' }],
  ['school principal', { organizationType: 'school', accountType: 'company', role: 'principal' }],
  ['school teacher', { organizationType: 'school', accountType: 'company', role: 'teacher' }],
  ['college admin', { organizationType: 'college', accountType: 'company', role: 'admin' }],
  ['university dean', { organizationType: 'university', accountType: 'company', role: 'dean' }],
  ['business guest', { organizationType: 'business', accountType: 'company', role: 'guest' }],
];

for (const [label, workspace] of unsupported) {
  test(`${label} does not see Social Publishing and cannot open it by URL`, async ({ page }) => {
    const socialRequests = await signIn(page, workspace);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Account & Workspace Settings/ })).toBeVisible();
    await expect(socialLink(page)).toHaveCount(0);

    await page.goto('/social-publishing');
    await expect(page).not.toHaveURL(/\/social-publishing/);
    await expect(page.getByText('This feature is not available for your organization or role.')).toHaveCount(0);
    expect(socialRequests).toEqual([]);
  });
}

test('education settings do not offer publishing connections', async ({ page }) => {
  const socialRequests = await signIn(page, { organizationType: 'university', accountType: 'company', role: 'admin' });
  await page.goto('/settings?tab=security');
  await expect(page.getByRole('heading', { name: 'Security & Authentication' })).toBeVisible();
  await expect(page.getByText(/LinkedIn publishing/i)).toHaveCount(0);
  expect(socialRequests).toEqual([]);
});
