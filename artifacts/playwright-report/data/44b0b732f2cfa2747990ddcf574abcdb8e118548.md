# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: academic.spec.ts >> Academic People — Registration form is visible on Students, Teachers, and Parents sections
- Location: tests\academic.spec.ts:198:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected substring: "Students"
Received string:    "Good to have you back."
Timeout: 10000ms

Call log:
  - Expect "toContainText" locator('h1') with timeout 10000ms
  - waiting for locator('h1')
    16 × locator resolved to <h1 class="auth-form-title">Good to have you back.</h1>
       - unexpected value "Good to have you back."

```

```yaml
- heading "Good to have you back." [level=1]
```

# Test source

```ts
  103 | 
  104 |   await page.route('**/api/academic/guardians', (route) => {
  105 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, links: [] }) });
  106 |   });
  107 | 
  108 |   await page.route('**/api/academic/classes', (route) => {
  109 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, classes }) });
  110 |   });
  111 | 
  112 |   await page.route('**/api/academic/enrollments', (route) => {
  113 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, enrollments }) });
  114 |   });
  115 | 
  116 |   await page.route('**/api/academic/teaching-assignments', (route) => {
  117 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, teachingAssignments: [] }) });
  118 |   });
  119 | 
  120 |   await page.route('**/api/academic/schedules', (route) => {
  121 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, schedules: [] }) });
  122 |   });
  123 | 
  124 |   await page.route('**/api/academic/assignments', (route) => {
  125 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, assignments: [] }) });
  126 |   });
  127 | 
  128 |   await page.route('**/api/academic/attendance', (route) => {
  129 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, attendance: [] }) });
  130 |   });
  131 | 
  132 |   await page.route('**/api/academic/assessments', (route) => {
  133 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, assessments }) });
  134 |   });
  135 | 
  136 |   await page.route('**/api/academic/results', (route) => {
  137 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: [] }) });
  138 |   });
  139 | 
  140 |   await page.route('**/api/academic/fees', (route) => {
  141 |     if (route.request().method() === 'POST') {
  142 |       const data = route.request().postDataJSON();
  143 |       const created = {
  144 |         _id: `fee-${Date.now()}`,
  145 |         studentId: people.find((p) => p._id === data.studentId),
  146 |         invoiceNumber: data.invoiceNumber,
  147 |         description: data.description,
  148 |         amountMinor: data.amountMinor,
  149 |         paidAmountMinor: 0,
  150 |         currency: data.currency,
  151 |         dueAt: data.dueAt,
  152 |         isVoided: false,
  153 |       };
  154 |       feeCharges.push(created);
  155 |       route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, charge: created }) });
  156 |     } else {
  157 |       route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, charges: feeCharges }) });
  158 |     }
  159 |   });
  160 | 
  161 |   await page.route('**/api/academic/fees/*/payments', (route) => {
  162 |     const data = route.request().postDataJSON();
  163 |     const charge = feeCharges[0];
  164 |     if (charge) {
  165 |       charge.paidAmountMinor += data.amountMinor;
  166 |     }
  167 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, charge }) });
  168 |   });
  169 | }
  170 | 
  171 | test('Academic Fees — Create Fee Challan does not render an infinite loader and submits successfully', async ({ page }) => {
  172 |   await setupAcademicPage(page);
  173 |   await page.goto('/academic?section=fees');
  174 | 
  175 |   // Verify header and page loaded
  176 |   await expect(page.locator('h1')).toContainText('Fees');
  177 | 
  178 |   // The submit button must NOT have an animate-spin loader
  179 |   const submitButton = page.locator('button[type="submit"]:has-text("Create fee charge")');
  180 |   await expect(submitButton).toBeVisible();
  181 |   await expect(submitButton.locator('.animate-spin')).toHaveCount(0);
  182 | 
  183 |   // Fill in Fee Challan form
  184 |   await page.locator('select').first().selectOption({ label: 'Alice Johnson' });
  185 |   await page.locator('input').nth(0).fill('CHALLAN-101');
  186 |   await page.locator('input').nth(1).fill('Annual Laboratory Fee');
  187 |   await page.locator('input').nth(2).fill('15000');
  188 |   await page.locator('input').nth(3).fill('USD');
  189 | 
  190 |   // Submit fee challan
  191 |   await submitButton.click();
  192 | 
  193 |   // Verify success feedback
  194 |   await expect(page.locator('[role="status"]')).toBeVisible();
  195 |   await expect(page.locator('[role="status"]')).toContainText('saved');
  196 | });
  197 | 
  198 | test('Academic People — Registration form is visible on Students, Teachers, and Parents sections', async ({ page }) => {
  199 |   await setupAcademicPage(page);
  200 | 
  201 |   // Visit Students section
  202 |   await page.goto('/academic?section=students');
> 203 |   await expect(page.locator('h1')).toContainText('Students');
      |                                    ^ Error: expect(locator).toContainText(expected) failed
  204 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  205 |   await expect(page.locator('button[type="submit"]:has-text("Register person")')).toBeVisible();
  206 | 
  207 |   // Visit Teachers section
  208 |   await page.goto('/academic?section=teachers');
  209 |   await expect(page.locator('h1')).toContainText('Teachers');
  210 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  211 |   await expect(page.locator('h2:has-text("Assign a teacher to a class")')).toBeVisible();
  212 | 
  213 |   // Visit Parents section
  214 |   await page.goto('/academic?section=parents');
  215 |   await expect(page.locator('h1')).toContainText('Parents');
  216 |   await expect(page.locator('h2:has-text("Register a person")')).toBeVisible();
  217 |   await expect(page.locator('h2:has-text("Link a parent or guardian")')).toBeVisible();
  218 | });
  219 | 
  220 | test('Academic Results — Student dropdown displays actively enrolled students for selected assessment', async ({ page }) => {
  221 |   await setupAcademicPage(page);
  222 |   await page.goto('/academic?section=results');
  223 | 
  224 |   await expect(page.locator('h1')).toContainText('Results');
  225 | 
  226 |   // Select the assessment
  227 |   const assessmentSelect = page.locator('select').first();
  228 |   await assessmentSelect.selectOption({ label: 'Midterm Exam' });
  229 | 
  230 |   // Student dropdown should now list Alice Johnson
  231 |   const studentSelect = page.locator('select').nth(1);
  232 |   await expect(studentSelect.locator('option')).toContainText(['Alice Johnson']);
  233 | });
  234 | 
```