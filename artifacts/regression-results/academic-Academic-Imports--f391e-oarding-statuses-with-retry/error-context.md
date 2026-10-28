# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: academic.spec.ts >> Academic Imports — exports records and shows onboarding statuses with retry
- Location: tests\academic.spec.ts:337:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: 'Export' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - img "WorkGrind" [ref=e7]
        - generic [ref=e11]:
          - generic [ref=e12]: Greenwood High School
          - generic [ref=e13]: School Admin
      - navigation [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e19]: Workspace
            - link "Calendar" [ref=e21] [cursor=pointer]:
              - /url: /calendar
          - generic [ref=e25]:
            - generic [ref=e26]: Overview
            - link "Academic Overview" [ref=e28] [cursor=pointer]:
              - /url: /academic?section=overview
          - generic [ref=e35]:
            - generic [ref=e36]: People
            - generic [ref=e37]:
              - link "Students" [ref=e38] [cursor=pointer]:
                - /url: /academic?section=students
              - link "Teachers" [ref=e44] [cursor=pointer]:
                - /url: /academic?section=teachers
              - link "Parents" [ref=e50] [cursor=pointer]:
                - /url: /academic?section=parents
          - generic [ref=e56]:
            - generic [ref=e57]: Academics
            - generic [ref=e58]:
              - link "Departments" [ref=e59] [cursor=pointer]:
                - /url: /academic?section=departments
              - link "Courses" [ref=e63] [cursor=pointer]:
                - /url: /academic?section=courses
              - link "Classes" [ref=e67] [cursor=pointer]:
                - /url: /academic?section=classes
              - link "Timetable" [ref=e71] [cursor=pointer]:
                - /url: /academic?section=timetable
              - link "Assignments" [ref=e75] [cursor=pointer]:
                - /url: /academic?section=assignments
          - generic [ref=e80]:
            - generic [ref=e81]: Academic operations
            - generic [ref=e82]:
              - link "Attendance" [ref=e83] [cursor=pointer]:
                - /url: /academic?section=attendance
              - link "Exams" [ref=e89] [cursor=pointer]:
                - /url: /academic?section=exams
              - link "Results" [ref=e95] [cursor=pointer]:
                - /url: /academic?section=results
          - generic [ref=e101]:
            - generic [ref=e102]: Finance
            - link "Fees" [ref=e104] [cursor=pointer]:
              - /url: /academic?section=fees
          - generic [ref=e108]:
            - generic [ref=e109]: Administration
            - link "Bulk import" [ref=e111] [cursor=pointer]:
              - /url: /academic?section=imports
          - generic [ref=e116]:
            - generic [ref=e117]: Collaborate
            - generic [ref=e118]:
              - link "Chat" [ref=e119] [cursor=pointer]:
                - /url: /chat
              - link "Meetings" [ref=e123] [cursor=pointer]:
                - /url: /meetings
          - generic [ref=e127]:
            - generic [ref=e128]: Resources
            - link "Files" [ref=e130] [cursor=pointer]:
              - /url: /files
          - generic [ref=e134]:
            - generic [ref=e135]: Admin
            - generic [ref=e136]:
              - link "Team" [ref=e137] [cursor=pointer]:
                - /url: /team
              - link "Notifications" [ref=e143] [cursor=pointer]:
                - /url: /notifications
              - link "Settings" [ref=e148] [cursor=pointer]:
                - /url: /settings
      - button "SA School Admin School Admin" [ref=e155] [cursor=pointer]:
        - generic [ref=e156]: SA
        - generic [ref=e160]:
          - generic [ref=e161]: School Admin
          - generic [ref=e162]: School Admin
    - generic [ref=e165]:
      - banner [ref=e166]:
        - generic [ref=e167]:
          - button "Toggle sidebar" [ref=e168] [cursor=pointer]
          - link "WorkGrind home" [ref=e170] [cursor=pointer]:
            - /url: /dashboard
            - img "WorkGrind" [ref=e172]:
              - generic [aria-hidden] [ref=e176]:
                - generic [ref=e177]: Work
                - generic [ref=e178]: Grind
          - button "Open search (Ctrl+K)" [ref=e179] [cursor=pointer]:
            - generic [ref=e183]: Search anything...
            - generic [ref=e184]: ⌘K
        - generic [ref=e185]:
          - generic [ref=e186]: Online
          - button "New" [ref=e191] [cursor=pointer]
          - button "Notifications" [ref=e197] [cursor=pointer]
          - link "Account settings" [ref=e201] [cursor=pointer]:
            - /url: /settings
            - generic [ref=e202]: SA
      - main [ref=e203]:
        - generic [ref=e204]:
          - generic [ref=e211]:
            - heading "Bulk import" [level=1] [ref=e213]
            - paragraph [ref=e214]: School · Greenwood High School · Education workspace. Academic tools depend on your role.
          - generic [ref=e216]:
            - generic [ref=e218]:
              - heading "Bulk import" [level=2] [ref=e219]
              - paragraph [ref=e220]: Validate and import institutional records without bypassing WorkGrind academic rules.
            - paragraph [ref=e224]: Download a template first. Use stable external IDs and tenant-owned WorkGrind IDs for related records; names alone are never used to link people.
            - generic [ref=e225]:
              - generic [ref=e226]:
                - text: Import module
                - combobox "Import module" [ref=e227]:
                  - option "Students and admissions" [selected]
                  - option "Departments / faculties"
              - generic [ref=e228]:
                - text: Import behavior
                - combobox "Import behavior" [ref=e229]:
                  - option "Create new records only" [selected]
                  - option "Update matching records only"
                  - option "Create new and update matching records"
                  - option "Create new and skip matching records"
              - generic [ref=e230]:
                - button "Download CSV template" [ref=e231] [cursor=pointer]
                - button "Download XLSX template" [ref=e235] [cursor=pointer]
            - button "Choose file CSV or XLSX · 50 MB maximum · 10,000 rows maximum" [ref=e239] [cursor=pointer]:
              - generic [ref=e243]: Choose file
              - generic [ref=e244]: CSV or XLSX · 50 MB maximum · 10,000 rows maximum
            - button "Choose File" [ref=e245]
            - generic [ref=e246]:
              - button "Preview and validate" [disabled]
              - button "Confirm import" [disabled] [ref=e247]
            - paragraph [ref=e248]: Choose a module and file to preview records.
            - generic [ref=e249]:
              - heading "Import history" [level=3] [ref=e250]
              - paragraph [ref=e251]: No imports have been run in this workspace.
            - paragraph [ref=e252]: Google Sheets sync is not connected yet. File imports are available now.
```

# Test source

```ts
  241 | 
  242 | test('Academic People — Registration form is visible on Students, Teachers, and Parents sections', async ({ page }) => {
  243 |   await setupAcademicPage(page);
  244 | 
  245 |   // Visit Students section
  246 |   await page.goto('/academic?section=students');
  247 |   await expect(page.locator('h1')).toContainText('Students');
  248 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  249 |   await expect(page.locator('button[type="submit"]:has-text("Register person")')).toBeVisible();
  250 | 
  251 |   // Visit Teachers section
  252 |   await page.goto('/academic?section=teachers');
  253 |   await expect(page.locator('h1')).toContainText('Teachers');
  254 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  255 |   await expect(page.locator('h2:has-text("Assign a teacher to a class")')).toBeVisible();
  256 | 
  257 |   // Visit Parents section
  258 |   await page.goto('/academic?section=parents');
  259 |   await expect(page.locator('h1')).toContainText('Parents');
  260 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  261 |   await expect(page.locator('h2:has-text("Link a parent or guardian")')).toBeVisible();
  262 | });
  263 | 
  264 | test('Academic Results — Student dropdown displays actively enrolled students for selected assessment', async ({ page }) => {
  265 |   await setupAcademicPage(page);
  266 |   await page.goto('/academic?section=results');
  267 | 
  268 |   await expect(page.locator('h1')).toContainText('Results');
  269 | 
  270 |   const resultsSection = page.locator('section:has(h2:has-text("Record a result"))');
  271 | 
  272 |   // Select the assessment
  273 |   const assessmentSelect = resultsSection.getByLabel('Assessment');
  274 |   await assessmentSelect.selectOption({ label: 'Midterm Exam' });
  275 | 
  276 |   // Student dropdown should now list Alice Johnson
  277 |   const studentSelect = resultsSection.getByLabel('Student');
  278 |   await expect(studentSelect.locator('option')).toContainText(['Alice Johnson']);
  279 | });
  280 | 
  281 | test('Academic Imports — administration panel exposes real template and validation actions', async ({ page }) => {
  282 |   await setupAcademicPage(page);
  283 |   await page.goto('/academic?section=imports');
  284 | 
  285 |   await expect(page.locator('h1')).toContainText('Import / Export');
  286 |   await expect(page.getByRole('heading', { name: 'Import, export and onboarding', level: 2 })).toBeVisible();
  287 |   await expect(page.getByRole('heading', { name: 'Bulk import', level: 3 })).toBeVisible();
  288 |   await expect(page.getByRole('tab', { name: 'Export' })).toBeVisible();
  289 |   await expect(page.getByRole('tab', { name: 'Invitations' })).toBeVisible();
  290 |   await expect(page.getByRole('button', { name: 'Download CSV template' })).toBeVisible();
  291 |   await expect(page.getByRole('button', { name: 'Download XLSX template' })).toBeVisible();
  292 |   await expect(page.getByRole('button', { name: 'Preview and validate' })).toBeDisabled();
  293 |   await expect(page.getByText('Google Sheets sync is not connected yet. File imports are available now.')).toBeVisible();
  294 | });
  295 | 
  296 | test('Academic Imports — downloads a template, maps columns, previews issues, confirms, and offers invitations', async ({ page }) => {
  297 |   const { invitationRequests } = await setupAcademicPage(page);
  298 |   await page.goto('/academic?section=imports');
  299 | 
  300 |   const downloadPromise = page.waitForEvent('download');
  301 |   await page.getByRole('button', { name: 'Download CSV template' }).click();
  302 |   const download = await downloadPromise;
  303 |   expect(download.suggestedFilename()).toBe('workgrind-students-template.csv');
  304 | 
  305 |   await page.locator('input[type="file"]').setInputFiles({
  306 |     name: 'students.csv',
  307 |     mimeType: 'text/csv',
  308 |     buffer: Buffer.from('externalId,firstName,lastName\nSTU-1,Ayesha,Khan\nSTU-1,Duplicate,Student\n'),
  309 |   });
  310 |   await page.getByRole('button', { name: 'Preview and validate' }).click();
  311 |   await expect(page.getByText('2 rows · 1 valid · 1 with issues')).toBeVisible();
  312 |   await expect(page.getByText('The stable matching key is duplicated in this upload.')).toBeVisible();
  313 |   await expect(page.getByText('1 new IDs will be generated automatically.')).toBeVisible();
  314 |   await expect(page.getByText('Auto', { exact: true })).toBeVisible();
  315 | 
  316 |   // Changing the column mapping requires validating again before importing.
  317 |   await page.getByLabel('Full name column').selectOption('student_name');
  318 |   await expect(page.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  319 |   await page.getByRole('button', { name: 'Validate with this mapping' }).click();
  320 |   await expect(page.getByRole('button', { name: 'Confirm import' })).toBeEnabled();
  321 | 
  322 |   page.once('dialog', (dialog) => dialog.accept());
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
> 341 |   await page.getByRole('tab', { name: 'Export' }).click();
      |                                                   ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
  423 |   await expect(page.getByRole('heading', { name: 'Greenwood High School' })).toBeVisible();
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
```