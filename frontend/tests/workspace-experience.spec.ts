import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Each workspace type is its own environment, decided by the organization the
 * server reports: Solo stays personal (no team meetings or chat, a personal
 * agenda instead), Business keeps team tools, and schools, colleges and
 * universities use academic navigation with their own terminology. The API is
 * mocked with fixtures; requests are recorded to prove nothing forbidden is
 * called.
 */

type Fixture = { organizationType: 'business' | 'school' | 'college' | 'university'; accountType: 'company' | 'individual'; role: string };

const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

async function signIn(page: Page, fixture: Fixture) {
  const requests: string[] = [];
  await page.addInitScript(() => sessionStorage.setItem('workgrind_access_token', 'playwright-experience-access'));
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO is not under test.' }));
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api/, '');
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (payload: unknown, status = 200) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(payload) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push(`${request.method()} ${path}`);

    const company = { _id: 'experience-company', name: 'Fixture Workspace', organizationType: fixture.organizationType, accountType: fixture.accountType, ownerId: 'experience-user' };
    const user = { _id: 'experience-user', fullName: 'Fixture Owner', email: 'owner@example.invalid', role: fixture.role, isActive: true, companyId: company, theme: 'light', preferredLanguage: 'en' };
    if (path === '/auth/me') return json({ success: true, user });
    if (path === '/auth/refresh') return json({ success: true, accessToken: 'playwright-experience-access' });
    if (path === '/subscription/status') {
      return json({
        success: true, source: 'company',
        subscription: {
          status: 'active', plan: 'pro', planName: 'Pro', hasActiveAccess: true, trialDaysRemaining: null, cancelAtPeriodEnd: false, entitlements,
          organizationType: fixture.organizationType, accountType: fixture.accountType,
          limits: { members: 100, storage: 1, aiRequests: 100 },
          usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    if (path === '/companies/stats') return json({ success: true, stats: { totalTasks: 12, completedTasks: 4, pendingTasks: 6, activeProjects: 2 } });
    if (path === '/tasks/my') return json({ success: true, tasks: [] });
    if (path === '/projects') return json({ success: true, projects: [] });
    if (path === '/meetings') return json({ success: true, meetings: [{ _id: 'meeting-1', title: 'Quarterly review', status: 'scheduled', scheduledAt: new Date(Date.now() + 86_400_000).toISOString() }] });
    if (path === '/channels') return json({ success: true, channels: [{ _id: 'channel-1', name: 'general' }] });
    if (path === '/messages') return json({ success: true, messages: [{ _id: 'message-1', content: 'Release notes are ready', createdAt: new Date().toISOString(), senderId: { fullName: 'Ali Raza' } }] });
    if (path === '/calendar') {
      return json({ success: true, events: [{ _id: 'event-1', title: 'Portfolio review', startDate: new Date(Date.now() + 2 * 86_400_000).toISOString(), color: '#0f766e' }] });
    }
    if (path === '/meetings/active') return json({ success: true, meetings: [] });
    if (path.startsWith('/academic/')) return json({ success: true, people: [], departments: [], courses: [], links: [], classes: [], enrollments: [], teachingAssignments: [], schedules: [], assignments: [], attendance: [], assessments: [], results: [], charges: [] });
    return json({ success: true, data: [], items: [], notifications: [], meetings: [] });
  });
  return requests;
}

const shell = (page: Page) => page.locator('[data-workspace-type]').first();
const sidebar = (page: Page) => page.locator('aside.workspace-sidebar');

test('a Solo dashboard stays personal: an agenda instead of team meetings and chat', async ({ page }) => {
  const requests = await signIn(page, { organizationType: 'business', accountType: 'individual', role: 'owner' });
  await page.goto('/dashboard');

  await expect(shell(page)).toHaveAttribute('data-workspace-type', 'solo');
  await expect(sidebar(page).getByTestId('workspace-type-label')).toHaveText('Personal workspace');
  await expect(page.getByText('Personal overview')).toBeVisible();
  await expect(page.getByTestId('agenda-card')).toContainText('Portfolio review');
  await expect(page.getByRole('link', { name: 'Open calendar →' })).toHaveAttribute('href', '/calendar');
  await expect(page.getByRole('button', { name: 'Meeting', exact: true })).toHaveCount(0);
  await expect(page.getByText('Workspace Pulse')).toHaveCount(0);
  await expect(page.getByText('Fixture Owner')).toBeVisible();
  expect(requests.filter((request) => /^GET \/(meetings|channels|messages)$/.test(request))).toEqual([]);
});

test('a Business dashboard keeps team meetings and chat', async ({ page }) => {
  const requests = await signIn(page, { organizationType: 'business', accountType: 'company', role: 'owner' });
  await page.goto('/dashboard');

  await expect(shell(page)).toHaveAttribute('data-workspace-type', 'company');
  await expect(sidebar(page).getByTestId('workspace-type-label')).toHaveText(/^Business · /);
  await expect(page.getByText('Business overview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Meeting', exact: true })).toBeVisible();
  await expect(page.getByText('Quarterly review')).toBeVisible();
  await expect(page.getByText('Workspace Pulse')).toBeVisible();
  await expect(page.getByText('Release notes are ready')).toBeVisible();
  await expect(page.getByTestId('agenda-card')).toHaveCount(0);
  expect(requests).toContain('GET /meetings');
});

test('a school uses academic navigation and calls courses Subjects', async ({ page }) => {
  await signIn(page, { organizationType: 'school', accountType: 'company', role: 'principal' });
  await page.goto('/academic?section=courses');

  await expect(shell(page)).toHaveAttribute('data-workspace-type', 'school');
  await expect(sidebar(page).getByTestId('workspace-type-label')).toHaveText(/^School · /);
  await expect(page.locator('h1')).toContainText('Subjects');
  await expect(sidebar(page).getByRole('link', { name: 'Subjects' })).toBeVisible();
  await expect(sidebar(page).getByRole('link', { name: 'Courses' })).toHaveCount(0);
  await expect(sidebar(page).getByRole('link', { name: 'CRM' })).toHaveCount(0);
  await expect(sidebar(page).getByRole('link', { name: 'Projects' })).toHaveCount(0);
});

test('a university calls its teachers Faculty and a college keeps Teachers and Courses', async ({ page }) => {
  await signIn(page, { organizationType: 'university', accountType: 'company', role: 'owner' });
  await page.goto('/academic?section=teachers');
  await expect(shell(page)).toHaveAttribute('data-workspace-type', 'university');
  await expect(sidebar(page).getByTestId('workspace-type-label')).toHaveText(/^University · /);
  await expect(page.locator('h1')).toContainText('Faculty');
  await expect(sidebar(page).getByRole('link', { name: 'Faculty' })).toBeVisible();
  await expect(sidebar(page).getByRole('link', { name: 'Teachers' })).toHaveCount(0);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await signIn(page, { organizationType: 'college', accountType: 'company', role: 'owner' });
  await page.goto('/academic?section=overview');
  await expect(shell(page)).toHaveAttribute('data-workspace-type', 'college');
  await expect(sidebar(page).getByRole('link', { name: 'Teachers' })).toBeVisible();
  await expect(sidebar(page).getByRole('link', { name: 'Courses' })).toBeVisible();
});

test('the workspace accent differs by workspace type and adapts to dark themes', async ({ page }) => {
  await signIn(page, { organizationType: 'school', accountType: 'company', role: 'owner' });
  await page.goto('/academic');
  const accent = () => shell(page).evaluate((element) => getComputedStyle(element).getPropertyValue('--workspace-accent').trim());
  await expect.poll(accent).toBe('#b45309');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'midnight'));
  await expect.poll(accent).toBe('#fcd34d');
});

test('the Solo dashboard fits a phone screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, { organizationType: 'business', accountType: 'individual', role: 'owner' });
  await page.goto('/dashboard');
  await expect(page.getByTestId('agenda-card')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
