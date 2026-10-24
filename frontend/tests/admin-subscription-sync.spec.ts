import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * An administrator's subscription change must be confirmed by the server
 * before the portal reports success, and the member's app must pick up the
 * workspace's new effective subscription without stale state.
 */

const workspaceId = '65f000000000000000000001';

const corsHeaders = (route: Route) => ({
  'access-control-allow-origin': route.request().headers().origin ?? 'http://127.0.0.1:3101',
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
});

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, headers: corsHeaders(route), contentType: 'application/json', body: JSON.stringify(body) });
}

const expiredSummary = { status: 'expired', plan: 'starter', hasActiveAccess: false, accessSource: 'none', expiresAt: null };
const grantedSummary = { status: 'active', plan: 'pro', hasActiveAccess: true, accessSource: 'manual_grant', expiresAt: null };

async function openAdminWorkspaces(page: Page, onPlanChange: (route: Route) => Promise<void>) {
  const state = { listRequests: 0, planChanges: [] as unknown[] };
  await page.addInitScript(() => {
    localStorage.setItem('workgrind_super_admin_token', 'playwright-admin-token');
    localStorage.setItem('workgrind_super_admin_user', JSON.stringify({
      _id: 'playwright-admin', fullName: 'Platform Admin', email: 'admin@example.invalid', role: 'owner', isSuperAdmin: true,
    }));
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders(route) });
    if (pathname.endsWith('/super-admin/auth/me')) {
      return json(route, { success: true, admin: { _id: 'playwright-admin', fullName: 'Platform Admin', email: 'admin@example.invalid', role: 'owner', isSuperAdmin: true } });
    }
    if (pathname.endsWith('/super-admin/workspaces')) {
      state.listRequests += 1;
      return json(route, {
        success: true, total: 1, totalPages: 1,
        workspaces: [{
          _id: workspaceId, name: 'Expired Agency', membersCount: 3, projectsCount: 1,
          ownerId: { fullName: 'Owner Person', email: 'owner@example.invalid' },
          subscription: { status: 'expired', plan: 'starter', limits: { members: 0, storage: 0, aiRequests: 0 } },
          usage: { storageBytes: 0, aiRequests: 0 }, createdAt: '2026-01-01T00:00:00.000Z',
        }],
      });
    }
    if (pathname.endsWith(`/super-admin/workspaces/${workspaceId}/plans`)) {
      return json(route, { success: true, plans: ['starter', 'pro', 'free'], subscription: expiredSummary });
    }
    if (pathname.endsWith(`/super-admin/workspaces/${workspaceId}/plan`) && request.method() === 'PATCH') {
      state.planChanges.push(request.postDataJSON());
      return onPlanChange(route);
    }
    return json(route, { success: true, counts: { unread: 0 } });
  });
  await page.goto('/admin-portal/workspaces');
  await page.getByTitle('Change Plan').click();
  const dialog = page.getByRole('dialog', { name: 'Workspace subscription' });
  await expect(dialog).toContainText('currently: No active access (expired)');
  return { state, dialog };
}

test('an administrator sees success only after the server confirms the new effective subscription', async ({ page }) => {
  const { state, dialog } = await openAdminWorkspaces(page, (route) => json(route, {
    success: true, previous: expiredSummary, subscription: grantedSummary,
  }));

  await dialog.getByRole('radio', { name: 'Pro' }).check();
  await dialog.getByLabel('Reason (recorded in the audit log)').fill('Support credit');
  const listRequestsBeforeSave = state.listRequests;
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog.getByRole('status')).toHaveText('Saved. Members now see: Pro · granted by an administrator');
  expect(state.planChanges).toEqual([{ plan: 'pro', reason: 'Support credit' }]);
  // The list reloads so the table shows the confirmed state too.
  await expect.poll(() => state.listRequests).toBeGreaterThan(listRequestsBeforeSave);
});

test('a rejected subscription change shows the server error and no success message', async ({ page }) => {
  const { dialog } = await openAdminWorkspaces(page, (route) => json(route, {
    success: false, code: 'PLAN_NOT_ALLOWED', message: 'This business workspace can be given: starter, pro, free.',
  }, 400));

  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('This business workspace can be given: starter, pro, free.');
  await expect(dialog.getByRole('status')).toHaveCount(0);
});

test('a session without super-admin rights is sent to the admin login instead of changing the subscription', async ({ page }) => {
  const { dialog } = await openAdminWorkspaces(page, (route) => json(route, { success: false, message: 'Super admin access required' }, 403));

  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/admin-portal\/login/);
  await expect(page.getByText('Saved. Members now see')).toHaveCount(0);
});

const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

function memberSubscription(active: boolean) {
  return active
    ? {
      status: 'active', plan: 'pro', planName: 'Pro', priceDisplay: '$29/month', hasActiveAccess: true,
      trialDaysRemaining: null, cancelAtPeriodEnd: false, accessSource: 'manual_grant', entitlements,
      limits: { members: 25, storage: 10_000_000_000, aiRequests: 500 },
      usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
    }
    : {
      status: 'expired', plan: 'starter', planName: 'Starter', priceDisplay: '$9/month', hasActiveAccess: false,
      trialDaysRemaining: null, cancelAtPeriodEnd: false, accessSource: 'none',
      entitlements: Object.fromEntries(Object.keys(entitlements).map((key) => [key, false])),
      limits: { members: 0, storage: 0, aiRequests: 0 },
      usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
    };
}

async function signInMember(page: Page, workspace: { active: boolean }) {
  const statusRequests: number[] = [];
  await page.routeWebSocket('**/socket.io/**', (socket) => {
    socket.close({ code: 1000, reason: 'Socket.IO is not under test.' });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'playwright-member-access');
    sessionStorage.setItem('workgrind_refresh_token', 'playwright-member-refresh');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders(route) });
    if (pathname.endsWith('/auth/me')) {
      return json(route, {
        success: true,
        user: {
          _id: 'playwright-member', fullName: 'Workspace Member', email: 'member@example.invalid', role: 'owner',
          companyId: { _id: workspaceId, name: 'Expired Agency', organizationType: 'business', accountType: 'company' },
          theme: 'light', preferredLanguage: 'en',
        },
      });
    }
    if (pathname.endsWith('/subscription/status')) {
      statusRequests.push(Date.now());
      return json(route, { success: true, source: 'company', subscription: memberSubscription(workspace.active) });
    }
    if (pathname.endsWith('/subscription/plans')) return json(route, { success: true, plans: [] });
    return json(route, { success: true, data: [], items: [], members: [], notifications: [], tasks: [], projects: [] });
  });
  return statusRequests;
}

test('a member whose workspace is granted access leaves the expired screen without reloading and stays active after refresh', async ({ page }) => {
  const workspace = { active: false };
  await page.clock.install();
  const statusRequests = await signInMember(page, workspace);

  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/subscription-expired/);
  const checksWhileExpired = statusRequests.length;

  // The administrator grants Pro; the member's open tab notices on its next check.
  workspace.active = true;
  await page.clock.fastForward(31_000);

  await expect(page).toHaveURL(/\/tasks/);
  expect(statusRequests.length).toBeGreaterThan(checksWhileExpired);

  await page.reload();
  await expect(page).toHaveURL(/\/tasks/);
  await page.clock.fastForward(2_000);
  await expect(page).not.toHaveURL(/\/subscription-expired/);
});

test('a genuinely expired workspace stays on the expired screen through background checks', async ({ page }) => {
  await page.clock.install();
  const statusRequests = await signInMember(page, { active: false });

  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/subscription-expired/);
  const before = statusRequests.length;
  await page.clock.fastForward(31_000);
  await expect.poll(() => statusRequests.length).toBeGreaterThan(before);
  await expect(page).toHaveURL(/\/subscription-expired/);
});
