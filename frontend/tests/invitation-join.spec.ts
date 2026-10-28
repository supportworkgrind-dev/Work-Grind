import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Registering from a workspace invitation (/join): the page sends the
 * invitation token and lets the server decide the workspace type, checks the
 * same password rules as the server before sending, and shows each problem
 * next to the field it concerns. The API is mocked with fixtures.
 */

type Invite = { email?: string; organizationType: string; role: string };

async function openInvitation(page: Page, invite: Invite, register: (body: Record<string, unknown>) => { status: number; body: unknown }) {
  const registrations: Record<string, unknown>[] = [];
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (payload: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(payload) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.startsWith('/auth/invite/')) {
      return json({ success: true, invite: { type: 'token', companyId: 'invite-company', companyName: 'Greenwood School', organizationType: invite.organizationType, role: invite.role, inviterName: 'Owner Person', ...(invite.email ? { email: invite.email } : {}) } });
    }
    if (path === '/auth/register') {
      const body = request.postDataJSON() as Record<string, unknown>;
      registrations.push(body);
      const response = register(body);
      return json(response.body, response.status);
    }
    if (path === '/auth/refresh' || path === '/auth/me') return json({ success: false }, 401);
    return json({ success: true });
  });
  await page.goto('/join?token=invite-token-123');
  await page.getByRole('button', { name: 'Create Account & Join' }).click();
  return registrations;
}

const accepted = () => ({ status: 202, body: { success: true, message: 'If these details can be registered, the verification request will be processed.' } });

test('an invited teacher registers with the invitation token and the server-chosen workspace type', async ({ page }) => {
  const registrations = await openInvitation(page, { email: 'teacher@greenwood.test', organizationType: 'school', role: 'teacher' }, accepted);

  const emailField = page.getByLabel('Email Address');
  await expect(emailField).toHaveValue('teacher@greenwood.test');
  await expect(emailField).toHaveAttribute('readonly', '');

  await page.getByLabel('Full Name').fill('Tariq Teacher');
  await page.getByLabel('Password').fill('weakpassword');
  await page.getByRole('button', { name: 'Register & Join' }).click();
  await expect(page.locator('#join-password-help')).toHaveText('Your password needs an uppercase letter, a number and a symbol such as ! @ # or ?.');
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
  expect(registrations).toHaveLength(0);

  await page.getByLabel('Password').fill('Str0ng!Passw0rd');
  await page.getByRole('button', { name: 'Register & Join' }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=teacher%40greenwood\.test&invite=invite-token-123/);
  expect(registrations).toEqual([{ fullName: 'Tariq Teacher', email: 'teacher@greenwood.test', password: 'Str0ng!Passw0rd', inviteToken: 'invite-token-123' }]);
});

test('a blank name is caught before sending', async ({ page }) => {
  const registrations = await openInvitation(page, { email: 'teacher@greenwood.test', organizationType: 'school', role: 'teacher' }, accepted);
  await page.getByLabel('Full Name').fill('   ');
  await page.getByLabel('Password').fill('Str0ng!Passw0rd');
  await page.getByRole('button', { name: 'Register & Join' }).click();
  await expect(page.locator('#join-full-name-error')).toHaveText('Enter your full name.');
  expect(registrations).toHaveLength(0);
});

test('server field errors appear beside their fields and invitation problems in the banner', async ({ page }) => {
  let reply: { status: number; body: unknown } = {
    status: 400,
    body: { success: false, code: 'REGISTRATION_INVALID', message: 'This invitation was sent to a different email address. Register with the invited email address.', errors: { email: 'This invitation was sent to a different email address. Register with the invited email address.' } },
  };
  // A code invitation names no address, so the email can be edited.
  await openInvitation(page, { organizationType: 'university', role: 'student' }, () => reply);
  await page.getByLabel('Full Name').fill('Sara Student');
  await page.getByLabel('Email Address').fill('sara@example.test');
  await page.getByLabel('Password').fill('Str0ng!Passw0rd');
  await page.getByRole('button', { name: 'Register & Join' }).click();
  await expect(page.locator('#join-email-error')).toContainText('different email address');
  await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Invitation Error:')).toHaveCount(0);

  reply = {
    status: 400,
    body: { success: false, code: 'REGISTRATION_INVALID', message: 'expired', errors: { invitation: 'This invitation link or code is invalid or has expired. Ask the workspace administrator for a new invitation.' } },
  };
  await page.getByRole('button', { name: 'Register & Join' }).click();
  await expect(page.getByText('This invitation link or code is invalid or has expired.')).toBeVisible();
  await expect(page.locator('#join-email-error')).toHaveCount(0);
});
