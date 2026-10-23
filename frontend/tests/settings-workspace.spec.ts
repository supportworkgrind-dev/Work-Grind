import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Settings visibility and feedback per workspace type and role. The API is
 * mocked with isolated fixtures; no production records are used.
 */

type Workspace = {
  organizationType: 'business' | 'school' | 'college' | 'university';
  accountType: 'company' | 'individual';
  role: string;
  owner?: boolean;
};

type Overrides = Partial<Record<string, (route: Route, body: unknown) => Promise<void> | void>>;

type Recorded = { method: string; path: string; body: unknown };

const USER_ID = 'settings-user';

const allEntitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

async function openSettings(page: Page, workspace: Workspace, overrides: Overrides = {}) {
  const requests: Recorded[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'playwright-settings-access');
  });
  await page.routeWebSocket('**/socket.io/**', (socket) => {
    socket.close({ code: 1000, reason: 'Socket.IO is not under test.' });
  });
  const company = {
    _id: 'settings-company',
    name: 'Fixture Workspace',
    organizationType: workspace.organizationType,
    accountType: workspace.accountType,
    ownerId: workspace.owner ? USER_ID : 'someone-else',
    industry: 'Technology',
    size: '11-50',
    country: 'Pakistan',
    timeZone: 'Asia/Karachi',
    currency: 'PKR',
    settings: { defaultRole: workspace.organizationType === 'business' ? 'employee' : 'student' },
    academicSettings: { academicYearStartMonth: 9, gradingScale: 'letter' },
  };
  const user = {
    _id: USER_ID,
    fullName: 'Fixture User',
    email: 'fixture@example.invalid',
    role: workspace.role,
    isActive: true,
    companyId: company,
    theme: 'light',
    preferredLanguage: 'en',
    notificationPreferences: { taskAssigned: true, meetingReminder: true, newMessage: true, dealUpdate: true },
  };
  const members = [
    user,
    { _id: 'member-2', fullName: 'Second Member', email: 'second@example.invalid', role: workspace.organizationType === 'business' ? 'employee' : 'teacher', isActive: true },
  ];

  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    let body: unknown;
    try { body = request.postDataJSON(); } catch { body = undefined; }
    if (request.method() !== 'OPTIONS') requests.push({ method: request.method(), path: pathname, body });
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? 'http://127.0.0.1:3101',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (payload: unknown, status = 200) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(payload) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    const override = overrides[`${request.method()} ${pathname}`];
    if (override) return override(route, body);

    if (pathname === '/auth/me') return json({ success: true, user });
    if (pathname === '/auth/refresh') return json({ success: true, accessToken: 'playwright-settings-access' });
    if (pathname === '/subscription/status') {
      return json({
        success: true,
        source: 'company',
        subscription: {
          status: 'active', plan: 'pro', organizationType: workspace.organizationType, accountType: workspace.accountType,
          planName: 'Pro', hasActiveAccess: true, trialDaysRemaining: null, cancelAtPeriodEnd: false,
          entitlements: allEntitlements,
          limits: { members: 100, storage: 1, aiRequests: 1 },
          usage: { members: 2, pendingInvites: 0, memberSlotsUsed: 2, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    if (pathname === '/users/me/calling-id') return json({ success: true, callingId: 'WG-FIXTURE' });
    if (pathname === '/auth/security') {
      return json({
        success: true,
        security: {
          email: user.email, emailVerified: true,
          signInMethods: { password: true, google: false, linkedin: false, apple: false },
          providersAvailable: { google: true, linkedin: true },
          mfa: { enabled: false, enabledAt: null, recoveryCodesRemaining: 0 },
          activeSessions: 3, lastLogin: null,
        },
      });
    }
    if (pathname === '/auth/security/events') return json({ success: true, events: [] });
    if (pathname === '/social-publishing/connection') {
      return json({ success: true, connection: { connected: false, status: 'disconnected', identityName: null, identityEmail: null, scopes: [], canPublishMemberPosts: false, expiresAt: null, errorCode: null } });
    }
    if (pathname === '/social-publishing/youtube/connection') {
      return json({ success: true, connection: { configured: false, connected: false, status: 'disconnected', channelTitle: null, channelId: null, identityEmail: null, scopes: [], canPublishVideos: false, errorCode: null } });
    }
    if (pathname === '/users/me/export') return json({ exportedAt: new Date().toISOString(), account: { email: user.email } });
    if (pathname === '/companies/invites') {
      return json({
        success: true,
        inviteCode: 'FIXT1234',
        invites: [{ email: 'pending@example.invalid', token: 'invite-1', role: workspace.organizationType === 'business' ? 'employee' : 'teacher', expiresAt: new Date(Date.now() + 86400000).toISOString() }],
      });
    }
    if (pathname === '/admin/members' || pathname === '/companies/members') {
      return json({ success: true, members, hasMore: false });
    }
    if (pathname === '/admin/audit-logs') {
      return json({ success: true, logs: [{ _id: 'log-1', action: 'member.role_changed', createdAt: new Date().toISOString(), userId: { fullName: 'Fixture User' } }], hasMore: false, actions: ['MEMBER_ROLE_CHANGED', 'PASSWORD_CHANGED'] });
    }
    if (pathname === '/users/me' && request.method() === 'PATCH') {
      return json({ success: true, user: { ...user, ...(body as object) } });
    }
    if (pathname === '/companies' && request.method() === 'PATCH') {
      return json({ success: true, company: { ...company, ...(body as object) } });
    }
    return json({ success: true });
  });

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /Account & Workspace Settings/ })).toBeVisible();
  return requests;
}

// Next.js renders its own empty role="alert" route announcer, so alerts are matched by text.
const BASE_TABS = ['My Profile', 'Preferences & Appearance', 'Authentication & Security', 'Notifications', 'Data & Privacy'];

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name, exact: true });

async function expectTabs(page: Page, visible: string[], hidden: string[]) {
  for (const name of [...BASE_TABS, ...visible]) {
    await expect(tab(page, name), `${name} is shown`).toBeVisible();
  }
  for (const name of hidden) {
    await expect(tab(page, name), `${name} is hidden`).toHaveCount(0);
  }
}

test.describe('settings visibility by workspace and role', () => {
  const ADMIN_TABS = ['Workspace Settings', 'Members & Roles', 'Audit Logs', 'Integrations', 'Billing & Subscription'];
  const ADMIN = ['Workspace Settings', 'Members & Roles', 'Audit Logs'];
  const cases: Array<[string, Workspace, string[]]> = [
    ['business owner', { organizationType: 'business', accountType: 'company', role: 'owner', owner: true }, ADMIN_TABS],
    ['business admin', { organizationType: 'business', accountType: 'company', role: 'admin' }, ADMIN_TABS],
    ['business manager', { organizationType: 'business', accountType: 'company', role: 'manager' }, ['Members & Roles', 'Integrations']],
    ['business employee', { organizationType: 'business', accountType: 'company', role: 'employee' }, []],
    ['solo owner', { organizationType: 'business', accountType: 'individual', role: 'owner', owner: true }, ['Workspace Settings', 'Integrations', 'Billing & Subscription']],
    ['school owner', { organizationType: 'school', accountType: 'company', role: 'owner', owner: true }, [...ADMIN, 'Billing & Subscription']],
    ['school principal', { organizationType: 'school', accountType: 'company', role: 'principal' }, ADMIN],
    ['school teacher', { organizationType: 'school', accountType: 'company', role: 'teacher' }, []],
    ['college admin', { organizationType: 'college', accountType: 'company', role: 'admin' }, ADMIN],
    ['university dean', { organizationType: 'university', accountType: 'company', role: 'dean' }, ['Members & Roles']],
    ['university student', { organizationType: 'university', accountType: 'company', role: 'student' }, []],
  ];

  for (const [label, workspace, visible] of cases) {
    test(`${label} sees only the settings their role can use`, async ({ page }) => {
      await openSettings(page, workspace);
      await expectTabs(page, visible, ADMIN_TABS.filter((name) => !visible.includes(name)));
    });
  }
});

test('solo workspace settings omit team administration and offer the supported team upgrade', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'individual', role: 'owner', owner: true });
  await tab(page, 'Workspace Settings').click();
  await expect(page.getByRole('heading', { name: 'Current Mode: Solo Workspace' })).toBeVisible();
  await expect(page.getByLabel('Default Member Role')).toHaveCount(0);
  await expect(page.getByText('Workspace Invitation Link & Code')).toHaveCount(0);
  await expect(page.getByText('Workspace owners can')).toHaveCount(0);

  // Converting needs an explicit inline confirmation before anything is sent.
  await page.getByRole('button', { name: 'Upgrade to Team Workspace' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Convert to a team workspace?');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(requests.some((r) => r.method === 'PATCH' && r.path === '/companies')).toBe(false);
  expect(requests.some((r) => r.path === '/companies/invites')).toBe(false);
});

test('education workspace settings show academic preferences and hide business-only fields', async ({ page }) => {
  await openSettings(page, { organizationType: 'school', accountType: 'company', role: 'principal' });
  await tab(page, 'Workspace Settings').click();
  await expect(page.getByLabel('Institution Name')).toHaveValue('Fixture Workspace');
  await expect(page.getByLabel('Academic year starts')).toHaveValue('9');
  await expect(page.getByLabel('Default grading scale')).toHaveValue('letter');
  await expect(page.getByLabel('Industry')).toHaveCount(0);
  // Organization type is shown but not editable from Settings.
  await expect(page.getByRole('combobox', { name: 'Organization type' })).toHaveCount(0);
  await expect(page.getByText('School', { exact: true })).toBeVisible();
});

test('notification toggles match the features the workspace can use', async ({ page }) => {
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  await tab(page, 'Notifications').click();
  await expect(page.getByRole('switch', { name: 'Tasks assigned to me' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'CRM deal updates' })).toBeVisible();
});

test('a school teacher is not offered business-only notification toggles', async ({ page }) => {
  await openSettings(page, { organizationType: 'school', accountType: 'company', role: 'teacher' });
  await tab(page, 'Notifications').click();
  await expect(page.getByRole('switch', { name: 'CRM deal updates' })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Tasks assigned to me' })).toHaveCount(0);
});

test('notification preferences persist and report success only after the server confirms', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  await tab(page, 'Notifications').click();
  await page.getByRole('switch', { name: 'Direct messages' }).uncheck();
  await page.getByRole('button', { name: 'Save notifications' }).click();
  await expect(page.getByText('Notification preferences saved to your account.')).toBeVisible();
  const saved = requests.find((r) => r.method === 'PATCH' && r.path === '/users/me');
  expect(saved?.body).toEqual({
    notificationPreferences: { taskAssigned: true, meetingReminder: true, newMessage: false, dealUpdate: true },
  });
});

test('a failed theme save restores the previous theme and shows the error', async ({ page }) => {
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'employee' }, {
    'PATCH /users/me': (route) => route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'http://127.0.0.1:3101', 'access-control-allow-credentials': 'true' },
      body: JSON.stringify({ success: false, message: 'Your profile could not be saved. Please try again.' }),
    }),
  });
  await tab(page, 'Preferences & Appearance').click();
  const themeButtons = page.locator('button[aria-pressed]');
  const initiallySelected = await page.locator('button[aria-pressed="true"]').getAttribute('aria-label');
  const target = themeButtons.filter({ has: page.locator('span') }).and(page.locator('button[aria-pressed="false"]')).first();
  await target.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Your profile could not be saved.' })).toBeVisible();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveAttribute('aria-label', initiallySelected ?? '');
});

test('workspace settings save only editable fields and confirm after the server responds', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'admin' });
  await tab(page, 'Workspace Settings').click();
  await page.getByLabel('Workspace / Organization Name').fill('Renamed Fixture');
  await page.getByRole('button', { name: 'Update Workspace' }).click();
  await expect(page.getByText('Workspace settings saved.')).toBeVisible();
  const saved = requests.find((r) => r.method === 'PATCH' && r.path === '/companies');
  expect(saved?.body).toMatchObject({ name: 'Renamed Fixture', settings: { defaultRole: 'employee' } });
  expect(saved?.body).not.toHaveProperty('organizationType');
  expect(saved?.body).not.toHaveProperty('accountType');
  expect(saved?.body).not.toHaveProperty('academicSettings');
});

test('a rejected workspace save shows the server error and no success message', async ({ page }) => {
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'admin' }, {
    'PATCH /companies': (route) => route.fulfill({
      status: 403,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'http://127.0.0.1:3101', 'access-control-allow-credentials': 'true' },
      body: JSON.stringify({ success: false, code: 'WORKSPACE_ADMIN_REQUIRED', message: 'Only workspace owners and administrators can make this change.' }),
    }),
  });
  await tab(page, 'Workspace Settings').click();
  await page.getByRole('button', { name: 'Update Workspace' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Only workspace owners and administrators can make this change.' })).toBeVisible();
  await expect(page.getByText('Workspace settings saved.')).toHaveCount(0);
  await expect(page.getByLabel('Workspace / Organization Name')).toHaveValue('Fixture Workspace');
});

test('an invalid time zone is rejected before anything is sent', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  await tab(page, 'Workspace Settings').click();
  await page.getByLabel('Default time zone (IANA)').fill('Mars/Olympus');
  await page.getByRole('button', { name: 'Update Workspace' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'valid IANA time zone' })).toBeVisible();
  expect(requests.some((r) => r.method === 'PATCH' && r.path === '/companies')).toBe(false);
});

test('a manager can list members but cannot change roles, suspend, remove, or revoke', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'manager' });
  await tab(page, 'Members & Roles').click();
  await expect(page.getByText('Second Member')).toBeVisible();
  await expect(page.getByLabel('Role for Second Member')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Suspend Second Member|Remove Second Member/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resend Email' })).toBeVisible();
  expect(requests.some((r) => r.path === '/admin/members')).toBe(false);
  expect(requests.some((r) => r.path === '/companies/members')).toBe(true);
});

test('a failed role change keeps the stored role and explains the failure', async ({ page }) => {
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true }, {
    'PATCH /admin/members/member-2/role': (route) => route.fulfill({
      status: 403,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'http://127.0.0.1:3101', 'access-control-allow-credentials': 'true' },
      body: JSON.stringify({ success: false, message: 'Elevated roles can only be assigned by the workspace owner.' }),
    }),
  });
  await tab(page, 'Members & Roles').click();
  const roleSelect = page.getByLabel('Role for Second Member');
  await roleSelect.selectOption('manager');
  await expect(page.getByRole('alert').filter({ hasText: 'Elevated roles can only be assigned by the workspace owner.' })).toBeVisible();
  await expect(roleSelect).toHaveValue('employee');
});

test('revoking an invitation asks for inline confirmation and sends nothing on cancel', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  await tab(page, 'Members & Roles').click();
  await page.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Revoke the invitation for pending@example.invalid?');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(requests.some((r) => r.method === 'DELETE')).toBe(false);

  await page.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('button', { name: 'Revoke invitation' }).click();
  await expect(page.getByText('Invitation revoked.')).toBeVisible();
  expect(requests.some((r) => r.method === 'DELETE' && r.path === '/companies/invites/invite-1')).toBe(true);
});

test('a failed audit-log request is shown as an error, not as an empty history', async ({ page }) => {
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true }, {
    'GET /admin/audit-logs': (route) => route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': 'http://127.0.0.1:3101', 'access-control-allow-credentials': 'true' },
      body: JSON.stringify({ success: false, message: 'Audit records could not be loaded.' }),
    }),
  });
  await tab(page, 'Audit Logs').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Audit records could not be loaded.' })).toBeVisible();
  await expect(page.getByText('No audit records logged yet.')).toHaveCount(0);
});

test('workspace owners are told why they cannot deactivate their account', async ({ page }) => {
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  await tab(page, 'Data & Privacy').click();
  await expect(page.getByText("Workspace owners can't deactivate their account while they own the workspace.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deactivate Account' })).toHaveCount(0);
});

test('settings tabs fit a phone-width viewport without horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  // The app shell opens its mobile sidebar on first load; close it like a user would.
  const closeSidebar = page.getByRole('button', { name: 'Close sidebar' });
  if (await closeSidebar.isVisible()) await closeSidebar.click({ position: { x: 375, y: 420 } });
  for (const name of [...BASE_TABS, 'Workspace Settings', 'Members & Roles', 'Integrations', 'Billing & Subscription', 'Audit Logs']) {
    await tab(page, name).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${name} has no horizontal page overflow`).toBeLessThanOrEqual(1);
  }
});

const corsJson = (route: Route, status: number, payload: unknown) => route.fulfill({
  status,
  contentType: 'application/json',
  headers: { 'access-control-allow-origin': 'http://127.0.0.1:3101', 'access-control-allow-credentials': 'true' },
  body: JSON.stringify(payload),
});

test('two-factor setup shows the QR code, enables only after the server confirms, and shows recovery codes once', async ({ page }) => {
  let enabled = false;
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'employee' }, {
    'POST /auth/mfa/setup': (route) => corsJson(route, 200, { success: true, qrCodeUrl: 'data:image/png;base64,iVBORw0KGgo=', manualKey: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x' }),
    'POST /auth/mfa/enable': (route, body) => {
      if ((body as { code?: string }).code !== '123456') return corsJson(route, 400, { success: false, message: 'That code is not valid. Check your authenticator app and try again.' });
      enabled = true;
      return corsJson(route, 200, { success: true, recoveryCodes: ['AAAA-1111', 'BBBB-2222', 'CCCC-3333', 'DDDD-4444', 'EEEE-5555', 'FFFF-6666', 'GGGG-7777', 'HHHH-8888'] });
    },
    'GET /auth/security': (route) => corsJson(route, 200, {
      success: true,
      security: {
        email: 'fixture@example.invalid', emailVerified: true,
        signInMethods: { password: true, google: false, linkedin: false, apple: false },
        providersAvailable: { google: false, linkedin: false },
        mfa: { enabled, enabledAt: enabled ? new Date().toISOString() : null, recoveryCodesRemaining: enabled ? 8 : 0 },
        activeSessions: 1, lastLogin: null,
      },
    }),
  });
  await tab(page, 'Authentication & Security').click();
  const mfaCard = page.locator('section', { has: page.getByRole('heading', { name: 'Two-factor authentication' }) });
  await expect(mfaCard.getByText('Off', { exact: true })).toBeVisible();
  await mfaCard.getByRole('button', { name: 'Set up two-factor authentication' }).click();
  await mfaCard.getByLabel('Current password').fill('Correct#Pass1');
  await mfaCard.getByRole('button', { name: 'Continue' }).click();
  await expect(mfaCard.getByRole('img', { name: 'QR code for your authenticator app' })).toBeVisible();
  await expect(mfaCard.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();

  await mfaCard.getByLabel('6-digit code').fill('000000');
  await mfaCard.getByRole('button', { name: 'Turn on' }).click();
  await expect(mfaCard.getByText('That code is not valid.', { exact: false })).toBeVisible();
  await expect(mfaCard.getByText('Off', { exact: true })).toBeVisible();

  await mfaCard.getByLabel('6-digit code').fill('123456');
  await mfaCard.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByRole('heading', { name: 'Your recovery codes' })).toBeVisible();
  await expect(page.getByText('AAAA-1111')).toBeVisible();
  await expect(mfaCard.getByText('On', { exact: true })).toBeVisible();
  expect(requests.find((r) => r.path === '/auth/mfa/setup')?.body).toEqual({ currentPassword: 'Correct#Pass1' });
});

test('the only sign-in method cannot be disconnected and sessions can be signed out', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'employee' }, {
    'GET /auth/security': (route) => corsJson(route, 200, {
      success: true,
      security: {
        email: 'fixture@example.invalid', emailVerified: true,
        signInMethods: { password: false, google: true, linkedin: false, apple: false },
        providersAvailable: { google: true, linkedin: false },
        mfa: { enabled: false, enabledAt: null, recoveryCodesRemaining: 0 },
        activeSessions: 3, lastLogin: null,
      },
    }),
    'POST /auth/sessions/revoke-others': (route) => corsJson(route, 200, { success: true, revoked: 2 }),
  });
  await tab(page, 'Authentication & Security').click();
  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeDisabled();
  await expect(page.getByText("You have one sign-in method, so it can't be removed.")).toBeVisible();
  await expect(page.getByText('Not available on this server')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out other sessions' }).click();
  await page.getByRole('button', { name: 'Sign out others' }).click();
  await expect(page.getByText('Signed out of 2 other sessions.')).toBeVisible();
  expect(requests.some((r) => r.method === 'POST' && r.path === '/auth/sessions/revoke-others')).toBe(true);
});

test('billing shows the real plan from the subscription status and links to the billing page', async ({ page }) => {
  await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  await tab(page, 'Billing & Subscription').click();
  await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByText('2 of 100')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage billing' })).toHaveAttribute('href', '/billing');
});

test('personal data export downloads the account file', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'employee' });
  await tab(page, 'Data & Privacy').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download data' }).click();
  expect((await download).suggestedFilename()).toBe('workgrind-account-data.json');
  await expect(page.getByText('Your download has started.')).toBeVisible();
  expect(requests.some((r) => r.path === '/users/me/export')).toBe(true);
});

test('audit logs can be filtered by recorded event type and date', async ({ page }) => {
  const requests = await openSettings(page, { organizationType: 'business', accountType: 'company', role: 'owner', owner: true });
  await tab(page, 'Audit Logs').click();
  await expect(page.getByText('member.role_changed')).toBeVisible();
  await page.getByLabel('Event type').selectOption('PASSWORD_CHANGED');
  await page.getByLabel('From').fill('2026-01-01');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect.poll(() => requests.filter((r) => r.path === '/admin/audit-logs').length).toBeGreaterThan(1);
  const last = page.waitForRequest((request) => request.url().includes('/admin/audit-logs') && request.url().includes('action=PASSWORD_CHANGED'));
  await page.getByRole('button', { name: 'Apply' }).click();
  const url = new URL((await last).url());
  expect(url.searchParams.get('action')).toBe('PASSWORD_CHANGED');
  expect(url.searchParams.get('from')).toBeTruthy();
});

test('sign-in with two-factor authentication asks for the code before creating a session', async ({ page }) => {
  let verified: unknown;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': 'http://127.0.0.1:3101', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'Authorization,Content-Type' } });
    if (pathname === '/auth/login') return corsJson(route, 200, { success: true, mfaRequired: true, mfaToken: 'challenge-token' });
    if (pathname === '/auth/mfa/verify-login') {
      verified = request.postDataJSON();
      return corsJson(route, 401, { success: false, message: 'That code is not valid.' });
    }
    if (pathname === '/auth/refresh') return corsJson(route, 401, { success: false, message: 'Refresh token required' });
    return corsJson(route, 200, { success: true });
  });
  await page.goto('/login');
  await page.getByLabel('Email address').fill('member@example.invalid');
  await page.locator('#login-password').fill('Correct#Pass1');
  await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  await expect(page.getByRole('heading', { name: 'Enter your code.' })).toBeVisible();
  await page.getByLabel('Authentication code').fill('000000');
  await page.getByRole('button', { name: /Verify and sign in/ }).click();
  await expect(page.locator('.auth-error[role="alert"]')).toContainText('That code is not valid.');
  expect(verified).toEqual({ mfaToken: 'challenge-token', code: '000000' });
  await expect(page).toHaveURL(/\/login/);
});

test('provider sign-in hands an MFA account to the code step instead of signing in', async ({ page }) => {
  let sessionRequests = 0;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': 'http://127.0.0.1:3101', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'Authorization,Content-Type' } });
    if (pathname === '/auth/oauth/exchange') return corsJson(route, 200, { success: true, mfaRequired: true, mfaToken: 'provider-challenge', returnTo: '/dashboard' });
    if (pathname === '/auth/me') sessionRequests += 1;
    if (pathname === '/auth/refresh') return corsJson(route, 401, { success: false, message: 'Refresh token required' });
    return corsJson(route, 200, { success: true });
  });
  await page.goto(`/auth/callback?code=${'c'.repeat(48)}`);
  await expect(page).toHaveURL(/\/login\?step=mfa$/);
  await expect(page.getByRole('heading', { name: 'Enter your code.' })).toBeVisible();
  expect(sessionRequests).toBe(0);
  // The challenge is removed from storage once the login page has taken it.
  expect(await page.evaluate(() => sessionStorage.getItem('workgrind_mfa_challenge'))).toBeNull();
});
