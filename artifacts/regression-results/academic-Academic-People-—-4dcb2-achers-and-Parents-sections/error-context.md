# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: academic.spec.ts >> Academic People — Registration form is visible on Students, Teachers, and Parents sections
- Location: tests\academic.spec.ts:174:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected substring: "Teachers"
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('h1') with timeout 15000ms
  - waiting for locator('h1')
  - Test timeout of 60000ms exceeded.

```

```yaml
- img "WorkGrind"
- alert
```

# Test source

```ts
  85  |     if (pathname === '/subscription/status') {
  86  |       return json({
  87  |         success: true,
  88  |         source: 'company',
  89  |         subscription: {
  90  |           status: 'active', plan: 'pro', organizationType, accountType: 'company',
  91  |           planName: 'Pro', hasActiveAccess: true,
  92  |           entitlements: { academic: true, fileStorage: true, teamChat: true, meetingsCalendar: true },
  93  |         },
  94  |       });
  95  |     }
  96  |     if (pathname === '/users') return json({ success: true, users: [user] });
  97  |     if (pathname === '/academic/people') {
  98  |       if (request.method() === 'POST') {
  99  |         const data = request.postDataJSON();
  100 |         const created = { _id: `person-${Date.now()}`, ...data, status: 'active' };
  101 |         people.push(created);
  102 |         return json({ success: true, person: created }, 201);
  103 |       }
  104 |       return json({ success: true, people });
  105 |     }
  106 |     if (pathname === '/academic/departments') return json({ success: true, departments });
  107 |     if (pathname === '/academic/courses') return json({ success: true, courses: [] });
  108 |     if (pathname === '/academic/guardians') return json({ success: true, links: [] });
  109 |     if (pathname === '/academic/classes') return json({ success: true, classes });
  110 |     if (pathname === '/academic/enrollments') return json({ success: true, enrollments });
  111 |     if (pathname === '/academic/teaching-assignments') return json({ success: true, teachingAssignments: [] });
  112 |     if (pathname === '/academic/schedules') return json({ success: true, schedules: [] });
  113 |     if (pathname === '/academic/assignments') return json({ success: true, assignments: [] });
  114 |     if (pathname === '/academic/attendance') return json({ success: true, attendance: [] });
  115 |     if (pathname === '/academic/assessments') return json({ success: true, assessments });
  116 |     if (pathname === '/academic/results') return json({ success: true, results: [] });
  117 |     if (pathname === '/academic/fees') {
  118 |       if (request.method() === 'POST') {
  119 |         const data = request.postDataJSON();
  120 |         const created = {
  121 |           _id: `fee-${Date.now()}`,
  122 |           studentId: people.find((p) => p._id === data.studentId)!,
  123 |           invoiceNumber: data.invoiceNumber,
  124 |           description: data.description,
  125 |           amountMinor: data.amountMinor,
  126 |           paidAmountMinor: 0,
  127 |           currency: data.currency,
  128 |           dueAt: data.dueAt,
  129 |           isVoided: false,
  130 |         };
  131 |         feeCharges.push(created);
  132 |         return json({ success: true, charge: created }, 201);
  133 |       }
  134 |       return json({ success: true, charges: feeCharges });
  135 |     }
  136 |     if (pathname.startsWith('/academic/fees/') && pathname.endsWith('/payments')) {
  137 |       const data = request.postDataJSON();
  138 |       const charge = feeCharges[0];
  139 |       if (charge) charge.paidAmountMinor += data.amountMinor;
  140 |       return json({ success: true, charge });
  141 |     }
  142 |     return json({ success: true });
  143 |   });
  144 | }
  145 | 
  146 | test('Academic Fees — Create Fee Challan does not render an infinite loader and submits successfully', async ({ page }) => {
  147 |   await setupAcademicPage(page);
  148 |   await page.goto('/academic?section=fees');
  149 | 
  150 |   await expect(page.locator('h1')).toContainText('Fees');
  151 | 
  152 |   const createFeeSection = page.locator('section:has(h2:has-text("Create fee charge"))');
  153 |   const submitButton = createFeeSection.locator('button[type="submit"]:has-text("Create fee charge")');
  154 | 
  155 |   // Verify the submit button is present and NOT in an infinite spinning loading state
  156 |   await expect(submitButton).toBeVisible();
  157 |   await expect(submitButton.locator('.animate-spin')).toHaveCount(0);
  158 | 
  159 |   // Fill in Fee Challan form
  160 |   await createFeeSection.getByLabel('Student').selectOption({ label: 'Alice Johnson' });
  161 |   await createFeeSection.getByLabel('Invoice number').fill('CHALLAN-101');
  162 |   await createFeeSection.getByLabel('Description').fill('Annual Laboratory Fee');
  163 |   await createFeeSection.getByLabel('Amount (minor units)').fill('15000');
  164 |   await createFeeSection.getByLabel('ISO currency').fill('USD');
  165 | 
  166 |   // Submit fee challan
  167 |   await submitButton.click();
  168 | 
  169 |   // Verify success feedback
  170 |   await expect(page.locator('[role="status"]')).toBeVisible();
  171 |   await expect(page.locator('[role="status"]')).toContainText('saved');
  172 | });
  173 | 
  174 | test('Academic People — Registration form is visible on Students, Teachers, and Parents sections', async ({ page }) => {
  175 |   await setupAcademicPage(page);
  176 | 
  177 |   // Visit Students section
  178 |   await page.goto('/academic?section=students');
  179 |   await expect(page.locator('h1')).toContainText('Students');
  180 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  181 |   await expect(page.locator('button[type="submit"]:has-text("Register person")')).toBeVisible();
  182 | 
  183 |   // Visit Teachers section
  184 |   await page.goto('/academic?section=teachers');
> 185 |   await expect(page.locator('h1')).toContainText('Teachers');
      |                                    ^ Error: expect(locator).toContainText(expected) failed
  186 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  187 |   await expect(page.locator('h2:has-text("Assign a teacher to a class")')).toBeVisible();
  188 | 
  189 |   // Visit Parents section
  190 |   await page.goto('/academic?section=parents');
  191 |   await expect(page.locator('h1')).toContainText('Parents');
  192 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  193 |   await expect(page.locator('h2:has-text("Link a parent or guardian")')).toBeVisible();
  194 | });
  195 | 
  196 | test('Academic Results — Student dropdown displays actively enrolled students for selected assessment', async ({ page }) => {
  197 |   await setupAcademicPage(page);
  198 |   await page.goto('/academic?section=results');
  199 | 
  200 |   await expect(page.locator('h1')).toContainText('Results');
  201 | 
  202 |   const resultsSection = page.locator('section:has(h2:has-text("Record a result"))');
  203 | 
  204 |   // Select the assessment
  205 |   const assessmentSelect = resultsSection.getByLabel('Assessment');
  206 |   await assessmentSelect.selectOption({ label: 'Midterm Exam' });
  207 | 
  208 |   // Student dropdown should now list Alice Johnson
  209 |   const studentSelect = resultsSection.getByLabel('Student');
  210 |   await expect(studentSelect.locator('option')).toContainText(['Alice Johnson']);
  211 | });
  212 | 
```