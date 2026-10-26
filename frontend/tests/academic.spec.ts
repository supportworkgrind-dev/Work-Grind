import { expect, test, type Page, type Route } from '@playwright/test';

const USER_ID = 'academic-admin-id';

async function setupAcademicPage(page: Page, options: { role?: string; organizationType?: 'school' | 'college' | 'university' } = {}) {
  const { role = 'admin', organizationType = 'school' } = options;

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
      return json({ success: true, modules: [{ id: 'students', label: 'Students and admissions', description: 'Student profiles', headers: ['externalId', 'firstName', 'lastName'], required: ['externalId', 'firstName', 'lastName'] }] });
    }
    if (pathname === '/academic/imports/history') return json({ success: true, jobs: [] });
    if (pathname.startsWith('/academic/fees/') && pathname.endsWith('/payments')) {
      const data = request.postDataJSON();
      const charge = feeCharges[0];
      if (charge) charge.paidAmountMinor += data.amountMinor;
      return json({ success: true, charge });
    }
    return json({ success: true });
  });
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

  await expect(page.locator('h1')).toContainText('Bulk import');
  await expect(page.getByRole('heading', { name: 'Bulk import' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CSV template' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download XLSX template' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview and validate' })).toBeDisabled();
  await expect(page.getByText('Google Sheets sync is not connected yet. File imports are available now.')).toBeVisible();
});
