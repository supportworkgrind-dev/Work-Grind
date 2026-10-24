import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Member roles follow the workspace type the server reports for the signed-in
 * member: universities, colleges and schools offer education roles (never
 * Employee, Manager or Guest), companies keep business roles, and Solo
 * workspaces have no member management. The API is mocked with fixtures.
 */

type WorkspaceType = 'business' | 'school' | 'college' | 'university';
type Fixture = {
  organizationType: WorkspaceType;
  accountType: 'company' | 'individual';
  role: string;
  owner?: boolean;
  members?: { _id: string; fullName: string; email: string; role: string }[];
  inviteResponse?: { status: number; body: unknown };
};

const USER_ID = 'roles-user';
const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

async function signIn(page: Page, fixture: { current: Fixture }) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  await page.addInitScript(() => sessionStorage.setItem('workgrind_access_token', 'playwright-roles-access'));
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO is not under test.' }));
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? 'http://127.0.0.1:3101',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (payload: unknown, status = 200) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(payload) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let body: unknown;
    try { body = request.postDataJSON(); } catch { body = undefined; }
    requests.push({ method: request.method(), path, body });

    const ws = fixture.current;
    const company = {
      _id: 'roles-company',
      name: 'Fixture Institution',
      organizationType: ws.organizationType,
      accountType: ws.accountType,
      ownerId: ws.owner ? USER_ID : 'someone-else',
      settings: { defaultRole: 'employee' },
      academicSettings: { academicYearStartMonth: 9, gradingScale: 'letter' },
      country: 'Pakistan', timeZone: 'Asia/Karachi', currency: 'PKR',
    };
    const user = {
      _id: USER_ID, fullName: 'Fixture User', email: 'fixture@example.invalid', role: ws.role,
      isActive: true, companyId: company, theme: 'light', preferredLanguage: 'en',
    };
    const members = [user, ...(ws.members ?? [])];

    if (path === '/auth/me') return json({ success: true, user });
    if (path === '/auth/refresh') return json({ success: true, accessToken: 'playwright-roles-access' });
    if (path === '/subscription/status') {
      return json({
        success: true, source: 'company',
        subscription: {
          status: 'active', plan: 'pro', planName: 'Pro', hasActiveAccess: true, trialDaysRemaining: null,
          cancelAtPeriodEnd: false, entitlements,
          limits: { members: 100, storage: 1, aiRequests: 1 },
          usage: { members: members.length, pendingInvites: 0, memberSlotsUsed: members.length, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    if (path === '/users' && request.method() === 'GET') return json({ success: true, users: members });
    if (path === '/admin/members' || path === '/companies/members') return json({ success: true, members, hasMore: false });
    if (path === '/companies/invites') return json({ success: true, inviteCode: 'FIXT1234', invites: [] });
    if (path === '/companies/invite' && request.method() === 'POST') {
      const response = ws.inviteResponse ?? { status: 200, body: { success: true, message: 'Invitation sent' } };
      return json(response.body, response.status);
    }
    if (path.startsWith('/admin/members/') && path.endsWith('/role')) {
      const memberId = path.split('/')[3];
      const member = members.find((entry) => entry._id === memberId);
      return json({ success: true, member: { ...member, role: (body as { role: string }).role } });
    }
    if (path === '/meetings/active') return json({ success: true, meetings: [] });
    return json({ success: true, data: [], items: [], members: [], notifications: [], meetings: [] });
  });
  return requests;
}

async function openInviteRoles(page: Page) {
  await page.getByRole('button', { name: 'Invite Member' }).first().click();
  const dialog = page.getByRole('dialog');
  const select = dialog.getByLabel('Role');
  return { dialog, select, labels: await select.locator('option').allTextContents() };
}

const BUSINESS_LABELS = ['Employee', 'Manager', 'Guest'];

test('a university owner invites with university roles only, preselected as Student', async ({ page }) => {
  const fixture = { current: {
    organizationType: 'university', accountType: 'company', role: 'owner', owner: true,
    members: [
      { _id: 'm-legacy', fullName: 'Earlier Staff', email: 'staff@uni.example', role: 'employee' },
      { _id: 'm-lecturer', fullName: 'Aisha Lecturer', email: 'aisha@uni.example', role: 'lecturer' },
    ],
  } as Fixture };
  const requests = await signIn(page, fixture);
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Institution Directory' })).toBeVisible();

  // Existing members keep their role; an earlier business role is flagged for the owner.
  await expect(page.locator('[data-role="employee"]')).toHaveText('Employee (earlier role)');
  await expect(page.locator('[data-role="lecturer"]')).toHaveText('Lecturer');

  const { select, labels } = await openInviteRoles(page);
  expect(labels).toEqual(['Vice Chancellor', 'University Admin', 'Dean', 'Head of Department', 'Professor', 'Lecturer', 'Teacher', 'Student', 'Parent / Guardian']);
  for (const label of BUSINESS_LABELS) expect(labels).not.toContain(label);
  await expect(select).toHaveValue('student');

  await page.getByLabel('Email Address').fill('prof@uni.example');
  await select.selectOption('professor');
  await page.getByRole('button', { name: 'Send Invite' }).click();
  await expect(page.getByText('Invitation sent!')).toBeVisible();
  expect(requests).toContainEqual({ method: 'POST', path: '/companies/invite', body: { email: 'prof@uni.example', role: 'professor' } });
});

test('a university administrator is offered only the roles they may assign', async ({ page }) => {
  await signIn(page, { current: { organizationType: 'university', accountType: 'company', role: 'admin' } });
  await page.goto('/team');
  const { labels } = await openInviteRoles(page);
  expect(labels).toEqual(['Professor', 'Lecturer', 'Teacher', 'Student', 'Parent / Guardian']);
});

test('a school principal sees school roles and no business roles', async ({ page }) => {
  await signIn(page, { current: { organizationType: 'school', accountType: 'company', role: 'principal' } });
  await page.goto('/team');
  await expect(page.getByText(/Browse your school’s staff, students, and parents/)).toBeVisible();
  const { labels } = await openInviteRoles(page);
  expect(labels).toEqual(['Teacher', 'Student', 'Parent / Guardian']);
});

test('a college owner sees college titles including Department Head and Lecturer', async ({ page }) => {
  await signIn(page, { current: { organizationType: 'college', accountType: 'company', role: 'owner', owner: true } });
  await page.goto('/team');
  const { labels } = await openInviteRoles(page);
  expect(labels).toEqual(['Principal', 'College Admin', 'Department Head', 'Lecturer', 'Teacher', 'Student', 'Parent / Guardian']);
});

test('a company owner keeps business roles, preselected as Employee', async ({ page }) => {
  await signIn(page, { current: { organizationType: 'business', accountType: 'company', role: 'owner', owner: true } });
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Team Directory' })).toBeVisible();
  const { select, labels } = await openInviteRoles(page);
  expect(labels).toEqual(['Admin', 'Manager', 'Employee', 'Guest']);
  await expect(select).toHaveValue('employee');
});

test('a Solo workspace has no team directory or member management', async ({ page }) => {
  await signIn(page, { current: { organizationType: 'business', accountType: 'individual', role: 'owner', owner: true } });
  await page.goto('/settings');
  const sidebar = page.locator('aside.workspace-sidebar');
  await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Team' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Members & Roles' })).toHaveCount(0);
});

test('an invitation the server refuses shows its reason instead of a success message', async ({ page }) => {
  await signIn(page, { current: {
    organizationType: 'school', accountType: 'company', role: 'principal',
    inviteResponse: { status: 403, body: { success: false, message: 'This role is not eligible for the organization or cannot be assigned by your role.' } },
  } });
  await page.goto('/team');
  await openInviteRoles(page);
  await page.getByLabel('Email Address').fill('teacher@school.example');
  await page.getByRole('button', { name: 'Send Invite' }).click();
  await expect(page.getByRole('dialog').getByText('This role is not eligible for the organization or cannot be assigned by your role.')).toBeVisible();
  await expect(page.getByText('Invitation sent!')).toHaveCount(0);
});

test('when the workspace type changes, the roles on offer change with it after reload', async ({ page }) => {
  const fixture = { current: { organizationType: 'business', accountType: 'company', role: 'owner', owner: true } as Fixture };
  await signIn(page, fixture);
  await page.goto('/team');
  expect((await openInviteRoles(page)).labels).toEqual(['Admin', 'Manager', 'Employee', 'Guest']);

  fixture.current = { organizationType: 'university', accountType: 'company', role: 'owner', owner: true };
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Institution Directory' })).toBeVisible();
  const { labels } = await openInviteRoles(page);
  expect(labels).toContain('Vice Chancellor');
  for (const label of BUSINESS_LABELS) expect(labels).not.toContain(label);
});

test('university settings list education roles and move an earlier Employee to Lecturer', async ({ page }) => {
  const requests = await signIn(page, { current: {
    organizationType: 'university', accountType: 'company', role: 'owner', owner: true,
    members: [{ _id: 'm-legacy', fullName: 'Earlier Staff', email: 'staff@uni.example', role: 'employee' }],
  } });
  await page.goto('/settings');
  const tabs = page.getByRole('navigation', { name: 'Settings sections' });
  await expect(tabs.getByRole('button', { name: 'Integrations' })).toHaveCount(0);

  await tabs.getByRole('button', { name: 'Institution Settings' }).click();
  await expect(page.getByRole('heading', { name: 'University Configuration' })).toBeVisible();
  await expect(page.getByLabel('Default Member Role').locator('option')).toHaveText(['Student', 'Parent / Guardian']);
  await expect(page.getByLabel('Default Member Role')).toHaveValue('student');

  await tabs.getByRole('button', { name: 'Members & Roles' }).click();
  const roleSelect = page.getByLabel('Role for Earlier Staff');
  await expect(roleSelect.locator('option:checked')).toHaveText('Employee (earlier role)');
  const options = await roleSelect.locator('option:not([disabled])').allTextContents();
  expect(options).toEqual(['Vice Chancellor', 'University Admin', 'Dean', 'Head of Department', 'Professor', 'Lecturer', 'Teacher', 'Student', 'Parent / Guardian']);
  await roleSelect.selectOption('lecturer');
  await expect.poll(() => requests.find((entry) => entry.method === 'PATCH' && entry.path === '/admin/members/m-legacy/role')?.body)
    .toEqual({ role: 'lecturer' });
  await expect(page.getByText('Earlier Staff’s role is now Lecturer.')).toBeVisible();
});
