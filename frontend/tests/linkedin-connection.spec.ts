import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * LinkedIn publishing connection states on the Social Publishing page. The API
 * is mocked with isolated fixtures; no LinkedIn account is contacted.
 */

const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

const baseConnection = {
  providerConfigured: true,
  requiredScope: 'w_member_social',
  formats: { text: true, image: ['image/jpeg', 'image/png'], video: ['video/mp4'] },
  connected: false,
  status: 'disconnected',
  identityName: null,
  identityEmail: null,
  scopes: [],
  canPublishMemberPosts: false,
  expiresAt: null,
  errorCode: null,
};

type Handler = (route: Route) => Promise<void> | void;

const headersFor = (route: Route) => ({
  'access-control-allow-origin': route.request().headers().origin ?? 'http://127.0.0.1:3101',
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
});
const reply = (route: Route, status: number, payload: unknown) =>
  route.fulfill({ status, headers: headersFor(route), contentType: 'application/json', body: JSON.stringify(payload) });

async function openPublishing(page: Page, connection: Handler | Record<string, unknown>, query = '', extra: Record<string, Handler> = {}) {
  const requests: string[] = [];
  await page.addInitScript(() => sessionStorage.setItem('workgrind_access_token', 'playwright-linkedin-access'));
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO is not under test.' }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: headersFor(route) });
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^.*\/api/, '');
    requests.push(`${request.method()} ${pathname}${url.search}`);
    const override = extra[`${request.method()} ${pathname}`];
    if (override) return override(route);
    if (pathname === '/auth/me') {
      return reply(route, 200, {
        success: true,
        user: {
          _id: 'li-user', fullName: 'Workspace Owner', email: 'owner@example.invalid', role: 'owner',
          companyId: { _id: 'li-company', name: 'Fixture Co', organizationType: 'business', accountType: 'company', ownerId: 'li-user' },
          theme: 'light', preferredLanguage: 'en',
        },
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
    if (pathname === '/social-publishing/connection') {
      return typeof connection === 'function'
        ? connection(route)
        : reply(route, 200, { success: true, connection: { ...baseConnection, ...connection } });
    }
    if (pathname === '/social-publishing/providers') {
      return reply(route, 200, { success: true, providers: [{ id: 'linkedin', name: 'LinkedIn', availability: 'available', capabilities: { connect: true, publishText: true, publishMedia: true, schedule: true, analytics: false, organizationPublishing: false } }] });
    }
    if (pathname === '/social-publishing/accounts') return reply(route, 200, { success: true, accounts: [] });
    if (pathname === '/social-publishing/posts') return reply(route, 200, { success: true, posts: [] });
    if (pathname === '/social-publishing/youtube/connection') {
      return reply(route, 200, { success: true, connection: { configured: false, connected: false, status: 'disconnected', channelTitle: null, channelId: null, identityEmail: null, scopes: [], canPublishVideos: false, errorCode: null } });
    }
    return reply(route, 200, { success: true });
  });
  await page.goto(`/social-publishing${query}`);
  return requests;
}

const card = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'LinkedIn publishing' }) });

test('a workspace that never connected LinkedIn is shown as not connected, not as a permission problem', async ({ page }) => {
  await openPublishing(page, { state: 'not_connected' });
  await expect(card(page).getByRole('status', { name: 'LinkedIn: Not connected' })).toBeVisible();
  await expect(card(page).getByText('Publishing permission unavailable')).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: 'Connect LinkedIn' })).toBeVisible();
});

test('a connection without w_member_social explains the missing permission and offers reconnection', async ({ page }) => {
  await openPublishing(page, { state: 'permission_missing', status: 'connected', identityName: 'Example Person', scopes: ['openid', 'profile', 'email'] });
  await expect(card(page).getByText('Posting permission missing')).toBeVisible();
  await expect(card(page).getByText(/did not allow posting \(w_member_social\)/)).toBeVisible();
  await expect(card(page).getByText(/Share on LinkedIn/)).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Reconnect LinkedIn' })).toBeVisible();
});

test('an expired LinkedIn authorization asks for reauthorization with its expiry date', async ({ page }) => {
  const expiredAt = new Date(Date.now() - 86_400_000).toISOString();
  await openPublishing(page, { state: 'reauthorization_required', status: 'connected', expiresAt: expiredAt, identityName: 'Example Person' });
  await expect(card(page).getByText('Reauthorization required')).toBeVisible();
  await expect(card(page).getByText(/expired on .*about 60 days/)).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Reconnect LinkedIn' })).toBeVisible();
});

test('without server configuration there is no connect button that cannot work', async ({ page }) => {
  await openPublishing(page, { state: 'configuration_required', providerConfigured: false });
  await expect(card(page).getByText('Setup required')).toBeVisible();
  await expect(card(page).getByRole('button', { name: /Connect LinkedIn|Reconnect LinkedIn/ })).toHaveCount(0);
});

test('returning from LinkedIn reports success only when the backend confirms the grant', async ({ page }) => {
  await openPublishing(page, { state: 'permission_missing', status: 'connected', scopes: ['openid', 'profile', 'email'] }, '?oauth=connected');
  await expect(card(page).getByRole('alert')).toContainText('publishing is still unavailable: posting permission missing');
  await expect(card(page).getByText(/WorkGrind confirmed permission/)).toHaveCount(0);
  await expect(page).toHaveURL(/\/social-publishing$/);
});

test('a confirmed reconnection is reported once the backend state is connected', async ({ page }) => {
  await openPublishing(page, {
    state: 'connected', status: 'connected', connected: true, canPublishMemberPosts: true,
    identityName: 'Example Person', scopes: ['openid', 'profile', 'email', 'w_member_social'],
    expiresAt: new Date(Date.now() + 50 * 86_400_000).toISOString(),
  }, '?oauth=connected');
  await expect(card(page).getByRole('status').filter({ hasText: 'WorkGrind confirmed permission to post to this profile' })).toBeVisible();
  await expect(card(page).getByRole('status', { name: 'LinkedIn: Connected — ready to publish' })).toBeVisible();
});

test('an unapproved LinkedIn app is explained as an approval problem', async ({ page }) => {
  await openPublishing(page, { state: 'not_connected' }, '?oauth_error=publishing_scope_not_approved');
  await expect(card(page).getByRole('alert')).toContainText('has not approved WorkGrind\'s LinkedIn app for member posting');
});

test('rejected app credentials are not blamed on the member\'s LinkedIn account', async ({ page }) => {
  await openPublishing(page, { state: 'not_connected' }, '?oauth_error=provider_credentials_rejected');
  await expect(card(page).getByRole('alert')).toContainText('not your LinkedIn account');
});

test('a temporary status failure offers Retry and recovers', async ({ page }) => {
  let attempts = 0;
  await openPublishing(page, (route) => {
    attempts += 1;
    return attempts === 1
      ? reply(route, 503, { success: false, message: 'LinkedIn status is temporarily unavailable.' })
      : reply(route, 200, { success: true, connection: { ...baseConnection, state: 'not_connected' } });
  });
  await expect(card(page).getByRole('alert')).toContainText('temporarily unavailable');
  await card(page).getByRole('button', { name: 'Retry' }).click();
  await expect(card(page).getByRole('status', { name: 'LinkedIn: Not connected' })).toBeVisible();
});

test('Connect starts the publishing consent flow on the backend', async ({ page }) => {
  await page.route('https://www.linkedin.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>LinkedIn consent (test stub)</p>' }));
  const requests = await openPublishing(page, { state: 'not_connected' }, '', {
    'GET /auth/oauth/linkedin/start': (route) => reply(route, 200, { success: true, authUrl: 'https://www.linkedin.com/oauth/v2/authorization?scope=openid%20profile%20email%20w_member_social' }),
  });
  await card(page).getByRole('button', { name: 'Connect LinkedIn' }).click();
  await expect.poll(() => requests.find((entry) => entry.startsWith('GET /auth/oauth/linkedin/start')) ?? '').toContain('intent=publishing');
});
