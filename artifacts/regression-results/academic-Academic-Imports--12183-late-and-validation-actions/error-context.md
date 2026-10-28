# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: academic.spec.ts >> Academic Imports — administration panel exposes real template and validation actions
- Location: tests\academic.spec.ts:281:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected substring: "Import / Export"
Received string:    "Bulk import"
Timeout: 15000ms

Call log:
  - Expect "toContainText" locator('h1') with timeout 15000ms
  - waiting for locator('h1')
    29 × locator resolved to <h1 class="page-title">Bulk import</h1>
       - unexpected value "Bulk import"

```

```yaml
- heading "Bulk import" [level=1]
```

# Test source

```ts
  185 |     if (pathname.startsWith('/academic/exports/')) {
  186 |       return route.fulfill({ status: 200, headers: { ...headers, 'content-disposition': 'attachment; filename="workgrind-students-2026-10-28.csv"' }, contentType: 'text/csv', body: 'externalId,firstName\nSTU-000001,Alice\n' });
  187 |     }
  188 |     if (pathname === '/academic/invitations/send') {
  189 |       invitationRequests.push(request.postDataJSON());
  190 |       return json({ success: true, results: [], summary: { sent: 1, failed: 1, already_linked: 0, already_accepted: 0, no_email: 1, inactive: 0 } });
  191 |     }
  192 |     if (pathname === '/academic/invitations') {
  193 |       return json({
  194 |         success: true, type: 'student', total: 3, page: 1, pageSize: 50,
  195 |         summary: { sent: 1, failed: 1, linked: 1 },
  196 |         invitations: [
  197 |           { personId: 'student-1', externalId: 'STU-000001', name: 'Alice Johnson', email: 'alice@greenwood.edu', recordStatus: 'active', accountLinked: false, invitationId: 'inv-1', status: 'sent', retryable: false, sendAttempts: 1, expiresAt: '2026-11-04T00:00:00.000Z' },
  198 |           { personId: 'student-2', externalId: 'STU-000002', name: 'Omar Khan', email: 'omar@bounce.test', recordStatus: 'active', accountLinked: false, invitationId: 'inv-2', status: 'failed', retryable: true, sendAttempts: 2, lastError: 'Email provider did not accept the recipient.' },
  199 |           { personId: 'student-3', externalId: 'STU-000003', name: 'Sara Ali', email: 'sara@greenwood.edu', recordStatus: 'active', accountLinked: true, status: 'linked', retryable: false, sendAttempts: 0 },
  200 |         ],
  201 |       });
  202 |     }
  203 |     if (pathname.startsWith('/academic/fees/') && pathname.endsWith('/payments')) {
  204 |       const data = request.postDataJSON();
  205 |       const charge = feeCharges[0];
  206 |       if (charge) charge.paidAmountMinor += data.amountMinor;
  207 |       return json({ success: true, charge });
  208 |     }
  209 |     return json({ success: true });
  210 |   });
  211 |   return { invitationRequests };
  212 | }
  213 | 
  214 | test('Academic Fees — Create Fee Challan does not render an infinite loader and submits successfully', async ({ page }) => {
  215 |   await setupAcademicPage(page);
  216 |   await page.goto('/academic?section=fees');
  217 | 
  218 |   await expect(page.locator('h1')).toContainText('Fees');
  219 | 
  220 |   const createFeeSection = page.locator('section:has(h2:has-text("Create fee charge"))');
  221 |   const submitButton = createFeeSection.locator('button[type="submit"]:has-text("Create fee charge")');
  222 | 
  223 |   // Verify the submit button is present and NOT in an infinite spinning loading state
  224 |   await expect(submitButton).toBeVisible();
  225 |   await expect(submitButton.locator('.animate-spin')).toHaveCount(0);
  226 | 
  227 |   // Fill in Fee Challan form
  228 |   await createFeeSection.getByLabel('Student').selectOption({ label: 'Alice Johnson' });
  229 |   await createFeeSection.getByLabel('Invoice number').fill('CHALLAN-101');
  230 |   await createFeeSection.getByLabel('Description').fill('Annual Laboratory Fee');
  231 |   await createFeeSection.getByLabel('Amount (minor units)').fill('15000');
  232 |   await createFeeSection.getByLabel('ISO currency').fill('USD');
  233 | 
  234 |   // Submit fee challan
  235 |   await submitButton.click();
  236 | 
  237 |   // Verify success feedback
  238 |   await expect(page.locator('[role="status"]')).toBeVisible();
  239 |   await expect(page.locator('[role="status"]')).toContainText('saved');
  240 | });
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
> 285 |   await expect(page.locator('h1')).toContainText('Import / Export');
      |                                    ^ Error: expect(locator).toContainText(expected) failed
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
```