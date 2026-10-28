# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: academic.spec.ts >> Academic invitation — a new student creates an account with the invited email, then verifies it
- Location: tests\academic.spec.ts:420:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Greenwood High School' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Greenwood High School' }) with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Greenwood High School' })

```

```yaml
- heading "404" [level=1]
- heading "This page could not be found." [level=2]
- alert
```

# Test source

```ts
  323 |   await page.getByRole('button', { name: 'Confirm import' }).click();
  324 |   await expect(page.locator('p[role="status"]').first()).toContainText('1 imported, 0 skipped, 1 failed. 1 IDs generated.');
  325 |   await expect(page.getByText('students.csv')).toBeVisible();
  326 | 
  327 |   // Invitations are only sent after an explicit confirmation.
  328 |   page.once('dialog', (dialog) => dialog.dismiss());
  329 |   await page.getByRole('button', { name: 'Send invitations' }).click();
  330 |   expect(invitationRequests).toHaveLength(0);
  331 |   page.once('dialog', (dialog) => dialog.accept());
  332 |   await page.getByRole('button', { name: 'Send invitations' }).click();
  333 |   await expect(page.getByText('1 sent · 1 failed · 1 skipped')).toBeVisible();
  334 |   expect(invitationRequests).toEqual([{ importJobId: 'import-job-1', confirmed: true }]);
  335 | });
  336 | 
  337 | test('Academic Imports — exports records and shows onboarding statuses with retry', async ({ page }) => {
  338 |   const { invitationRequests } = await setupAcademicPage(page);
  339 |   await page.goto('/academic?section=imports');
  340 | 
  341 |   await page.getByRole('tab', { name: 'Export' }).click();
  342 |   const downloadPromise = page.waitForEvent('download');
  343 |   await page.getByRole('button', { name: 'Export CSV' }).click();
  344 |   expect((await downloadPromise).suggestedFilename()).toBe('workgrind-students-2026-10-28.csv');
  345 |   await expect(page.getByText('Export downloaded.')).toBeVisible();
  346 | 
  347 |   await page.getByRole('tab', { name: 'Invitations' }).click();
  348 |   const rows = page.locator('tbody tr');
  349 |   await expect(rows).toHaveCount(3);
  350 |   await expect(rows.filter({ hasText: 'Omar Khan' })).toContainText('Failed');
  351 |   await expect(rows.filter({ hasText: 'Omar Khan' })).toContainText('Email provider did not accept the recipient.');
  352 |   await expect(rows.filter({ hasText: 'Sara Ali' })).toContainText('Account linked');
  353 |   await expect(rows.filter({ hasText: 'Sara Ali' }).getByRole('button')).toHaveCount(0);
  354 | 
  355 |   page.once('dialog', (dialog) => dialog.accept());
  356 |   await rows.filter({ hasText: 'Omar Khan' }).getByRole('button', { name: 'Resend' }).click();
  357 |   await expect(page.getByText('1 sent · 1 failed · 1 skipped')).toBeVisible();
  358 |   expect(invitationRequests).toEqual([{ personIds: ['student-2'], confirmed: true }]);
  359 | });
  360 | 
  361 | test('Academic Imports — people sections link to Import / Export and department heads are kept out', async ({ page }) => {
  362 |   await setupAcademicPage(page);
  363 |   await page.goto('/academic?section=students');
  364 |   await page.getByRole('link', { name: 'Import / Export' }).first().click();
  365 |   await expect(page).toHaveURL(/section=imports&module=students/);
  366 |   await expect(page.getByLabel('Import module')).toHaveValue('students');
  367 | 
  368 |   await page.unrouteAll({ behavior: 'ignoreErrors' });
  369 |   await setupAcademicPage(page, { role: 'hod', organizationType: 'university' });
  370 |   await page.goto('/academic?section=imports');
  371 |   await expect(page.getByText('Imports, exports and invitations are available to institution administrators.')).toBeVisible();
  372 |   await expect(page.getByRole('button', { name: 'Download CSV template' })).toHaveCount(0);
  373 | });
  374 | 
  375 | test('Academic Imports — shows a service error while loading import options', async ({ page }) => {
  376 |   await setupAcademicPage(page, { importsError: true });
  377 |   await page.goto('/academic?section=imports');
  378 |   await expect(page.locator('p[role="alert"]')).toContainText('Import service unavailable.');
  379 | });
  380 | 
  381 | async function setupInvitePage(page: Page, options: { signedInEmail?: string } = {}) {
  382 |   const requests: Array<{ path: string; body: unknown }> = [];
  383 |   if (options.signedInEmail) {
  384 |     await page.addInitScript(() => { sessionStorage.setItem('workgrind_access_token', 'invitee-token'); });
  385 |   }
  386 |   await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO disabled in test.' }));
  387 |   await page.route('**/api/**', async (route: Route) => {
  388 |     const request = route.request();
  389 |     const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
  390 |     const headers = {
  391 |       'access-control-allow-origin': request.headers().origin ?? '*',
  392 |       'access-control-allow-credentials': 'true',
  393 |       'access-control-allow-methods': 'GET,POST,OPTIONS',
  394 |       'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
  395 |     };
  396 |     const json = (payload: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(payload) });
  397 |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  398 |     if (request.method() !== 'GET') requests.push({ path: pathname, body: request.postDataJSON() });
  399 |     if (pathname === '/auth/me') {
  400 |       return options.signedInEmail
  401 |         ? json({ success: true, user: { _id: 'invitee-id', fullName: 'Ayesha Khan', email: options.signedInEmail, role: 'owner', isActive: true, isVerified: true, companyId: null } })
  402 |         : json({ success: false }, 401);
  403 |     }
  404 |     if (pathname === '/auth/refresh') return options.signedInEmail ? json({ success: true, accessToken: 'invitee-token' }) : json({ success: false }, 401);
  405 |     if (pathname === '/academic-invitations/invalid-token-value') return json({ success: false, message: 'This invitation link is invalid, expired, or has already been used.' }, 404);
  406 |     if (pathname.startsWith('/academic-invitations/') && request.method() === 'GET') {
  407 |       return json({ success: true, invitation: { institutionName: 'Greenwood High School', organizationType: 'school', role: 'student', firstName: 'Ayesha', email: 'ayesha@student.test', expiresAt: '2026-11-04T00:00:00.000Z' } });
  408 |     }
  409 |     if (pathname === '/academic-invitations/accept') {
  410 |       return json({ success: true, accessToken: 'linked-token', role: 'student', joined: true, company: { _id: 'academic-org-id', name: 'Greenwood High School', organizationType: 'school', accountType: 'company' }, user: { _id: 'invitee-id', fullName: 'Ayesha Khan', email: 'ayesha@student.test', role: 'student', isVerified: true } });
  411 |     }
  412 |     if (pathname === '/auth/register') return json({ success: true, message: 'processed' }, 202);
  413 |     return json({ success: true });
  414 |   });
  415 |   return requests;
  416 | }
  417 | 
  418 | const INVITE_TOKEN = 'A'.repeat(43);
  419 | 
  420 | test('Academic invitation — a new student creates an account with the invited email, then verifies it', async ({ page }) => {
  421 |   const requests = await setupInvitePage(page);
  422 |   await page.goto(`/academic-invite?token=${INVITE_TOKEN}`);
> 423 |   await expect(page.getByRole('heading', { name: 'Greenwood High School' })).toBeVisible();
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
  424 |   await expect(page.getByText('ayesha@student.test')).toBeVisible();
  425 |   await page.getByRole('button', { name: 'Create my account' }).click();
  426 |   await expect(page.getByLabel('Email address')).toHaveValue('ayesha@student.test');
  427 |   await expect(page.getByLabel('Email address')).toHaveAttribute('readonly', '');
  428 |   await page.getByLabel('Full name').fill('Ayesha Khan');
  429 |   await page.getByLabel('Password').fill('Str0ng!Passw0rd');
  430 |   await page.getByRole('button', { name: 'Create account and verify email' }).click();
  431 |   await expect(page).toHaveURL(/\/verify-email\?email=ayesha%40student\.test&academicInvite=A{43}/);
  432 |   expect(requests.find((request) => request.path === '/auth/register')?.body).toMatchObject({ email: 'ayesha@student.test', organizationType: 'school', accountType: 'company' });
  433 | });
  434 | 
  435 | test('Academic invitation — a signed-in account with the invited email links to the institution', async ({ page }) => {
  436 |   const requests = await setupInvitePage(page, { signedInEmail: 'ayesha@student.test' });
  437 |   await page.goto(`/academic-invite?token=${INVITE_TOKEN}`);
  438 |   await page.getByRole('button', { name: 'Link my account to Greenwood High School' }).click();
  439 |   await expect(page.getByRole('heading', { name: 'Your account is linked' })).toBeVisible();
  440 |   expect(requests).toContainEqual({ path: '/academic-invitations/accept', body: { token: INVITE_TOKEN } });
  441 | });
  442 | 
  443 | test('Academic invitation — a different signed-in email cannot accept, and invalid links explain why', async ({ page }) => {
  444 |   await setupInvitePage(page, { signedInEmail: 'someone.else@example.test' });
  445 |   await page.goto(`/academic-invite?token=${INVITE_TOKEN}`);
  446 |   await expect(page.getByText('This invitation was sent to ayesha@student.test.')).toBeVisible();
  447 |   await expect(page.getByRole('button', { name: /Link my account/ })).toHaveCount(0);
  448 | 
  449 |   await page.goto('/academic-invite?token=invalid-token-value');
  450 |   await expect(page.getByRole('alert')).toContainText('invalid, expired, or has already been used');
  451 | });
  452 | 
```