import { expect, test, type Page, type Route } from '@playwright/test';

const USER_ID = 'academic-admin-id';

async function setupAcademicPage(page: Page, options: { role?: string; organizationType?: 'school' | 'college' | 'university'; importsError?: boolean } = {}) {
  const { role = 'admin', organizationType = 'school', importsError = false } = options;

  await page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'test-academic-token');
  });

  await page.routeWebSocket('**/socket.io/**', (socket) => {
    socket.close({ code: 1000, reason: 'Socket.IO disabled in test.' });
  });

  const company = {
    _id: 'academic-org-id',
    name: 'Greenwood High School',
    organizationType,
    accountType: 'company',
    ownerId: USER_ID,
  };

  const user = {
    _id: USER_ID,
    fullName: 'School Admin',
    email: 'admin@greenwood.edu',
    role,
    isActive: true,
    companyId: company,
  };

  const feeCharges = [
    {
      _id: 'fee-1',
      studentId: { _id: 'student-1', firstName: 'Alice', lastName: 'Johnson' },
      invoiceNumber: 'INV-2026-001',
      description: 'Term 1 Tuition',
      amountMinor: 50000,
      paidAmountMinor: 20000,
      currency: 'USD',
      dueAt: '2026-11-30T00:00:00.000Z',
      isVoided: false,
    },
  ];

  const people = [
    { _id: 'student-1', type: 'student', firstName: 'Alice', lastName: 'Johnson', status: 'active' },
    { _id: 'teacher-1', type: 'teacher', firstName: 'Robert', lastName: 'Smith', status: 'active' },
    { _id: 'parent-1', type: 'parent', firstName: 'David', lastName: 'Johnson', status: 'active' },
  ];

  const departments = [
    { _id: 'dept-1', name: 'Science Department', code: 'SCI' },
  ];

  const classes = [
    { _id: 'class-1', name: 'Grade 10 Science', academicYear: '2026-2027', departmentId: 'dept-1' },
  ];

  const enrollments = [
    { _id: 'enroll-1', studentId: { _id: 'student-1', firstName: 'Alice', lastName: 'Johnson' }, classId: { _id: 'class-1', name: 'Grade 10 Science' }, enrolledAt: new Date().toISOString() },
  ];

  const assessments = [
    { _id: 'assess-1', title: 'Midterm Exam', type: 'exam', pointsPossible: 100, classId: { _id: 'class-1', name: 'Grade 10 Science' } },
  ];
  const importJobs: Array<Record<string, unknown>> = [];
  const invitationRequests: Array<Record<string, unknown>> = [];
  const studentFields = [
    { key: 'externalId', label: 'Student ID', help: 'Leave blank to generate.' },
    { key: 'fullName', label: 'Full name', help: 'Used when names are blank.' },
    { key: 'firstName', label: 'First name', required: true, help: 'Required unless fullName is provided.' },
    { key: 'lastName', label: 'Last name', required: true, help: 'Required unless fullName is provided.' },
    { key: 'email', label: 'Email', help: 'Optional.' },
  ];

  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (payload: unknown, status = 200) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(payload) });

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    if (pathname === '/auth/me') return json({ success: true, user });
    if (pathname === '/auth/refresh') return json({ success: true, accessToken: 'test-academic-token' });
    if (pathname === '/subscription/status') {
      return json({
        success: true,
        source: 'company',
        subscription: {
          status: 'active', plan: 'pro', organizationType, accountType: 'company',
          planName: 'Pro', hasActiveAccess: true,
          entitlements: { academic: true, fileStorage: true, teamChat: true, meetingsCalendar: true },
        },
      });
    }
    if (pathname === '/users') return json({ success: true, users: [user] });
    if (pathname === '/academic/people') {
      if (request.method() === 'POST') {
        const data = request.postDataJSON();
        const created = { _id: `person-${Date.now()}`, ...data, status: 'active' };
        people.push(created);
        return json({ success: true, person: created }, 201);
      }
      return json({ success: true, people });
    }
    if (pathname === '/academic/departments') return json({ success: true, departments });
    if (pathname === '/academic/courses') return json({ success: true, courses: [] });
    if (pathname === '/academic/guardians') return json({ success: true, links: [] });
    if (pathname === '/academic/classes') return json({ success: true, classes });
    if (pathname === '/academic/enrollments') return json({ success: true, enrollments });
    if (pathname === '/academic/teaching-assignments') return json({ success: true, teachingAssignments: [] });
    if (pathname === '/academic/schedules') return json({ success: true, schedules: [] });
    if (pathname === '/academic/assignments') return json({ success: true, assignments: [] });
    if (pathname === '/academic/attendance') return json({ success: true, attendance: [] });
    if (pathname === '/academic/assessments') return json({ success: true, assessments });
    if (pathname === '/academic/results') return json({ success: true, results: [] });
    if (pathname === '/academic/fees') {
      if (request.method() === 'POST') {
        const data = request.postDataJSON();
        const created = {
          _id: `fee-${Date.now()}`,
          studentId: people.find((p) => p._id === data.studentId)!,
          invoiceNumber: data.invoiceNumber,
          description: data.description,
          amountMinor: data.amountMinor,
          paidAmountMinor: 0,
          currency: data.currency,
          dueAt: data.dueAt,
          isVoided: false,
        };
        feeCharges.push(created);
        return json({ success: true, charge: created }, 201);
      }
      return json({ success: true, charges: feeCharges });
    }
    if (pathname === '/academic/imports/modules') {
      if (importsError) return json({ success: false, message: 'Import service unavailable.' }, 503);
      return json({ success: true, modules: [
        { id: 'students', label: 'Students and admissions', description: 'Student profiles', headers: studentFields.map((field) => field.key), required: ['firstName', 'lastName'], fields: studentFields, exportable: true, invitable: true },
        { id: 'departments', label: 'Departments / faculties', description: 'Departments keyed by code.', headers: ['code', 'name'], required: ['code', 'name'], fields: [], exportable: true, invitable: false },
      ] });
    }
    if (pathname.startsWith('/academic/imports/templates/')) {
      return route.fulfill({ status: 200, headers, contentType: 'text/csv', body: '# WorkGrind template\nexternalId,firstName,lastName\n' });
    }
    if (pathname === '/academic/imports/preview') {
      const body = request.postDataBuffer()?.toString('utf8') ?? '';
      const remapped = body.includes('"fullName":"student_name"');
      return json({
        success: true,
        preview: {
          sheets: ['CSV'], worksheet: 'CSV', headers: ['student_id', 'student_name', 'surname'], headerLabels: ['Student ID', 'Student Name', 'Surname'], totalRows: 2,
          fields: studentFields,
          mapping: { externalId: 'student_id', fullName: remapped ? 'student_name' : null, firstName: null, lastName: 'surname', email: null },
          unmappedHeaders: remapped ? [] : ['student_name'],
          previewRows: [
            { rowNumber: 2, action: 'create', values: { externalId: '', lastName: 'Khan' }, generated: ['externalId'] },
            { rowNumber: 3, action: 'error', values: { externalId: 'STU-1', lastName: 'Student' }, generated: [] },
          ],
          issues: [{ rowNumber: 3, field: 'externalId', code: 'duplicate_upload', message: 'The stable matching key is duplicated in this upload.' }],
          validRows: 1, invalidRows: 1, warningCount: 0, actions: { create: 1, update: 0, skip: 0 }, generatedIds: 1,
        },
      });
    }
    if (pathname === '/academic/imports/jobs' && request.method() === 'POST') {
      const job = { id: 'import-job-1', module: 'students', mode: 'create_only', originalFilename: 'students.csv', status: 'completed_with_errors', totalRows: 2, processedRows: 2, successfulRows: 1, skippedRows: 0, failedRows: 1, issueCount: 1, generatedIdCount: 1, personCount: 1, createdAt: new Date().toISOString() };
      importJobs.push(job);
      return json({ success: true, job }, 201);
    }
    if (pathname === '/academic/imports/history') return json({ success: true, jobs: importJobs });
    if (pathname.startsWith('/academic/imports/progress/')) return json({ success: true, progress: { status: 'processing', totalRows: 2, processedRows: 1 } });
    if (pathname === '/academic/imports/settings') {
      if (request.method() === 'PUT') return json({ success: true, settings: request.postDataJSON() });
      return json({ success: true, settings: { studentIdPrefix: 'STU', teacherIdPrefix: 'TCH', parentIdPrefix: 'GRD', idPadding: 6, rollNumberMode: 'manual', rollNumberPadding: 2 } });
    }
    if (pathname.startsWith('/academic/exports/')) {
      return route.fulfill({ status: 200, headers: { ...headers, 'content-disposition': 'attachment; filename="workgrind-students-2026-10-28.csv"' }, contentType: 'text/csv', body: 'externalId,firstName\nSTU-000001,Alice\n' });
    }
    if (pathname === '/academic/invitations/send') {
      invitationRequests.push(request.postDataJSON());
      return json({ success: true, results: [], summary: { sent: 1, failed: 1, already_linked: 0, already_accepted: 0, no_email: 1, inactive: 0 } });
    }
    if (pathname === '/academic/invitations') {
      return json({
        success: true, type: 'student', total: 3, page: 1, pageSize: 50,
        summary: { sent: 1, failed: 1, linked: 1 },
        invitations: [
          { personId: 'student-1', externalId: 'STU-000001', name: 'Alice Johnson', email: 'alice@greenwood.edu', recordStatus: 'active', accountLinked: false, invitationId: 'inv-1', status: 'sent', retryable: false, sendAttempts: 1, expiresAt: '2026-11-04T00:00:00.000Z' },
          { personId: 'student-2', externalId: 'STU-000002', name: 'Omar Khan', email: 'omar@bounce.test', recordStatus: 'active', accountLinked: false, invitationId: 'inv-2', status: 'failed', retryable: true, sendAttempts: 2, lastError: 'Email provider did not accept the recipient.' },
          { personId: 'student-3', externalId: 'STU-000003', name: 'Sara Ali', email: 'sara@greenwood.edu', recordStatus: 'active', accountLinked: true, status: 'linked', retryable: false, sendAttempts: 0 },
        ],
      });
    }
    if (pathname.startsWith('/academic/fees/') && pathname.endsWith('/payments')) {
      const data = request.postDataJSON();
      const charge = feeCharges[0];
      if (charge) charge.paidAmountMinor += data.amountMinor;
      return json({ success: true, charge });
    }
    return json({ success: true });
  });
  return { invitationRequests };
}

test('Academic Fees — Create Fee Challan does not render an infinite loader and submits successfully', async ({ page }) => {
  await setupAcademicPage(page);
  await page.goto('/academic?section=fees');

  await expect(page.locator('h1')).toContainText('Fees');

  const createFeeSection = page.locator('section:has(h2:has-text("Create fee charge"))');
  const submitButton = createFeeSection.locator('button[type="submit"]:has-text("Create fee charge")');

  // Verify the submit button is present and NOT in an infinite spinning loading state
  await expect(submitButton).toBeVisible();
  await expect(submitButton.locator('.animate-spin')).toHaveCount(0);

  // Fill in Fee Challan form
  await createFeeSection.getByLabel('Student').selectOption({ label: 'Alice Johnson' });
  await createFeeSection.getByLabel('Invoice number').fill('CHALLAN-101');
  await createFeeSection.getByLabel('Description').fill('Annual Laboratory Fee');
  await createFeeSection.getByLabel('Amount (minor units)').fill('15000');
  await createFeeSection.getByLabel('ISO currency').fill('USD');

  // Submit fee challan
  await submitButton.click();

  // Verify success feedback
  await expect(page.locator('[role="status"]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toContainText('saved');
});

test('Academic People — Registration form is visible on Students, Teachers, and Parents sections', async ({ page }) => {
  await setupAcademicPage(page);

  // Visit Students section
  await page.goto('/academic?section=students');
  await expect(page.locator('h1')).toContainText('Students');
  await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  await expect(page.locator('button[type="submit"]:has-text("Register person")')).toBeVisible();

  // Visit Teachers section
  await page.goto('/academic?section=teachers');
  await expect(page.locator('h1')).toContainText('Teachers');
  await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  await expect(page.locator('h2:has-text("Assign a teacher to a class")')).toBeVisible();

  // Visit Parents section
  await page.goto('/academic?section=parents');
  await expect(page.locator('h1')).toContainText('Parents');
  await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  await expect(page.locator('h2:has-text("Link a parent or guardian")')).toBeVisible();
});

test('Academic Results — Student dropdown displays actively enrolled students for selected assessment', async ({ page }) => {
  await setupAcademicPage(page);
  await page.goto('/academic?section=results');

  await expect(page.locator('h1')).toContainText('Results');

  const resultsSection = page.locator('section:has(h2:has-text("Record a result"))');

  // Select the assessment
  const assessmentSelect = resultsSection.getByLabel('Assessment');
  await assessmentSelect.selectOption({ label: 'Midterm Exam' });

  // Student dropdown should now list Alice Johnson
  const studentSelect = resultsSection.getByLabel('Student');
  await expect(studentSelect.locator('option')).toContainText(['Alice Johnson']);
});

test('Academic Imports — administration panel exposes real template and validation actions', async ({ page }) => {
  await setupAcademicPage(page);
  await page.goto('/academic?section=imports');

  await expect(page.locator('h1')).toContainText('Import / Export');
  await expect(page.getByRole('heading', { name: 'Import, export and onboarding', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bulk import', level: 3 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Export' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Invitations' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CSV template' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download XLSX template' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview and validate' })).toBeDisabled();
  await expect(page.getByText('Google Sheets sync is not connected yet. File imports are available now.')).toBeVisible();
});

test('Academic Imports — downloads a template, maps columns, previews issues, confirms, and offers invitations', async ({ page }) => {
  const { invitationRequests } = await setupAcademicPage(page);
  await page.goto('/academic?section=imports');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV template' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('workgrind-students-template.csv');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'students.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('externalId,firstName,lastName\nSTU-1,Ayesha,Khan\nSTU-1,Duplicate,Student\n'),
  });
  await page.getByRole('button', { name: 'Preview and validate' }).click();
  await expect(page.getByText('2 rows · 1 valid · 1 with issues')).toBeVisible();
  await expect(page.getByText('The stable matching key is duplicated in this upload.')).toBeVisible();
  await expect(page.getByText('1 new IDs will be generated automatically.')).toBeVisible();
  await expect(page.getByText('Auto', { exact: true })).toBeVisible();

  // Changing the column mapping requires validating again before importing.
  await page.getByLabel('Full name column').selectOption('student_name');
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  await page.getByRole('button', { name: 'Validate with this mapping' }).click();
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeEnabled();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.locator('p[role="status"]').first()).toContainText('1 imported, 0 skipped, 1 failed. 1 IDs generated.');
  await expect(page.getByText('students.csv')).toBeVisible();

  // Invitations are only sent after an explicit confirmation.
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Send invitations' }).click();
  expect(invitationRequests).toHaveLength(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Send invitations' }).click();
  await expect(page.getByText('1 sent · 1 failed · 1 skipped')).toBeVisible();
  expect(invitationRequests).toEqual([{ importJobId: 'import-job-1', confirmed: true }]);
});

test('Academic Imports — exports records and shows onboarding statuses with retry', async ({ page }) => {
  const { invitationRequests } = await setupAcademicPage(page);
  await page.goto('/academic?section=imports');

  await page.getByRole('tab', { name: 'Export' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('workgrind-students-2026-10-28.csv');
  await expect(page.getByText('Export downloaded.')).toBeVisible();

  await page.getByRole('tab', { name: 'Invitations' }).click();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: 'Omar Khan' })).toContainText('Failed');
  await expect(rows.filter({ hasText: 'Omar Khan' })).toContainText('Email provider did not accept the recipient.');
  await expect(rows.filter({ hasText: 'Sara Ali' })).toContainText('Account linked');
  await expect(rows.filter({ hasText: 'Sara Ali' }).getByRole('button')).toHaveCount(0);

  page.once('dialog', (dialog) => dialog.accept());
  await rows.filter({ hasText: 'Omar Khan' }).getByRole('button', { name: 'Resend' }).click();
  await expect(page.getByText('1 sent · 1 failed · 1 skipped')).toBeVisible();
  expect(invitationRequests).toEqual([{ personIds: ['student-2'], confirmed: true }]);
});

test('Academic Imports — people sections link to Import / Export and department heads are kept out', async ({ page }) => {
  await setupAcademicPage(page);
  await page.goto('/academic?section=students');
  // The sidebar's section link has the same name; use the one in the people card.
  await page.locator('section:has(h2:has-text("Register a person"))').getByRole('link', { name: 'Import / Export' }).click();
  await expect(page).toHaveURL(/section=imports&module=students/);
  await expect(page.getByLabel('Import module')).toHaveValue('students');

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await setupAcademicPage(page, { role: 'hod', organizationType: 'university' });
  await page.goto('/academic?section=imports');
  // Department heads are sent back to the overview and have no Import / Export entry.
  await expect(page.locator('h1')).toContainText('Academic Overview');
  await expect(page.getByRole('link', { name: 'Import / Export' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download CSV template' })).toHaveCount(0);
});

test('Academic Imports — shows a service error while loading import options', async ({ page }) => {
  await setupAcademicPage(page, { importsError: true });
  await page.goto('/academic?section=imports');
  await expect(page.locator('p[role="alert"]')).toContainText('Import service unavailable.');
});

async function setupInvitePage(page: Page, options: { signedInEmail?: string } = {}) {
  const requests: Array<{ path: string; body: unknown }> = [];
  if (options.signedInEmail) {
    await page.addInitScript(() => { sessionStorage.setItem('workgrind_access_token', 'invitee-token'); });
  }
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO disabled in test.' }));
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (payload: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(payload) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() !== 'GET') requests.push({ path: pathname, body: request.postDataJSON() });
    if (pathname === '/auth/me') {
      return options.signedInEmail
        ? json({ success: true, user: { _id: 'invitee-id', fullName: 'Ayesha Khan', email: options.signedInEmail, role: 'owner', isActive: true, isVerified: true, companyId: null } })
        : json({ success: false }, 401);
    }
    if (pathname === '/auth/refresh') return options.signedInEmail ? json({ success: true, accessToken: 'invitee-token' }) : json({ success: false }, 401);
    if (pathname === '/academic-invitations/invalid-token-value') return json({ success: false, message: 'This invitation link is invalid, expired, or has already been used.' }, 404);
    if (pathname.startsWith('/academic-invitations/') && request.method() === 'GET') {
      return json({ success: true, invitation: { institutionName: 'Greenwood High School', organizationType: 'school', role: 'student', firstName: 'Ayesha', email: 'ayesha@student.test', expiresAt: '2026-11-04T00:00:00.000Z' } });
    }
    if (pathname === '/academic-invitations/accept') {
      return json({ success: true, accessToken: 'linked-token', role: 'student', joined: true, company: { _id: 'academic-org-id', name: 'Greenwood High School', organizationType: 'school', accountType: 'company' }, user: { _id: 'invitee-id', fullName: 'Ayesha Khan', email: 'ayesha@student.test', role: 'student', isVerified: true } });
    }
    if (pathname === '/auth/register') return json({ success: true, message: 'processed' }, 202);
    return json({ success: true });
  });
  return requests;
}

const INVITE_TOKEN = 'A'.repeat(43);

test('Academic invitation — a new student creates an account with the invited email, then verifies it', async ({ page }) => {
  const requests = await setupInvitePage(page);
  await page.goto(`/academic-invite?token=${INVITE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Greenwood High School' })).toBeVisible();
  await expect(page.getByText('ayesha@student.test')).toBeVisible();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page.getByLabel('Email address')).toHaveValue('ayesha@student.test');
  await expect(page.getByLabel('Email address')).toHaveAttribute('readonly', '');
  await page.getByLabel('Full name').fill('Ayesha Khan');
  await page.getByLabel('Password').fill('Str0ng!Passw0rd');
  await page.getByRole('button', { name: 'Create account and verify email' }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=ayesha%40student\.test&academicInvite=A{43}/);
  // The institution type comes from the invitation on the server, not from the page.
  const registration = requests.find((request) => request.path === '/auth/register')?.body as Record<string, unknown>;
  expect(registration).toMatchObject({ email: 'ayesha@student.test', academicInviteToken: INVITE_TOKEN });
  expect(registration).not.toHaveProperty('organizationType');
  expect(registration).not.toHaveProperty('accountType');
});

test('Academic invitation — a signed-in account with the invited email links to the institution', async ({ page }) => {
  const requests = await setupInvitePage(page, { signedInEmail: 'ayesha@student.test' });
  await page.goto(`/academic-invite?token=${INVITE_TOKEN}`);
  await page.getByRole('button', { name: 'Link my account to Greenwood High School' }).click();
  await expect(page.getByRole('heading', { name: 'Your account is linked' })).toBeVisible();
  expect(requests).toContainEqual({ path: '/academic-invitations/accept', body: { token: INVITE_TOKEN } });
});

test('Academic invitation — a different signed-in email cannot accept, and invalid links explain why', async ({ page }) => {
  await setupInvitePage(page, { signedInEmail: 'someone.else@example.test' });
  await page.goto(`/academic-invite?token=${INVITE_TOKEN}`);
  await expect(page.getByText('This invitation was sent to ayesha@student.test.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Link my account/ })).toHaveCount(0);

  await page.goto('/academic-invite?token=invalid-token-value');
  // Next's route announcer is also role="alert", so match the message itself.
  await expect(page.getByRole('alert').filter({ hasText: 'invalid, expired, or has already been used' })).toBeVisible();
});
