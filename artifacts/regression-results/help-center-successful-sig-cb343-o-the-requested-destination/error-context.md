# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: help-center.spec.ts >> successful sign-in returns an existing member to the requested destination
- Location: tests\help-center.spec.ts:61:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('Work email')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - complementary "WorkGrind workspace preview" [ref=e3]:
      - generic [ref=e4]:
        - img "WorkGrind" [ref=e5]:
          - generic [aria-hidden] [ref=e9]:
            - generic [ref=e10]: Work
            - generic [ref=e11]: Grind
        - generic [ref=e12]: WORK, IN GOOD ORDER.
      - generic [ref=e13]:
        - paragraph [ref=e14]: FOR WORK, BUSINESS, AND LEARNING
        - heading "One workspace for work and learning." [level=2] [ref=e15]: One workspacefor work and learning.
        - paragraph [ref=e16]: Personal planning, team collaboration, and academic administration, with Tavro AI for work and learning where available.
      - generic "Illustration of a WorkGrind workspace" [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: MONDAY / OVERVIEW
          - generic [ref=e20]: SAMPLE
        - generic [ref=e22]: Good morning, team.
        - generic [ref=e24]:
          - generic [ref=e28]:
            - strong [ref=e29]: Launch planning
            - generic [ref=e30]: Product / Due today
          - generic [ref=e31]: AM
        - generic [ref=e32]:
          - generic [ref=e36]:
            - strong [ref=e37]: Review Q3 pipeline
            - generic [ref=e38]: Sales / In progress
          - generic [ref=e39]: JL
        - generic [ref=e40]:
          - generic [ref=e41]: FOCUS BLOCK
          - strong [ref=e45]: 2h 40m
      - paragraph [ref=e49]: For individuals, organizations, and education teams.
    - generic [ref=e50]:
      - generic [ref=e51]:
        - paragraph [ref=e52]: YOUR WORKSPACE AWAITS
        - heading "Good to have you back." [level=1] [ref=e53]
        - paragraph [ref=e54]: Sign in to continue in your WorkGrind workspace.
        - generic [ref=e56]:
          - button "Continue with Google" [ref=e57] [cursor=pointer]
          - button "Continue with LinkedIn" [ref=e63] [cursor=pointer]
        - generic [ref=e66]: or sign in with email
        - generic [ref=e69]:
          - generic [ref=e70]:
            - generic [ref=e71]: Email address
            - textbox "Email address" [ref=e73]:
              - /placeholder: you@example.com
          - generic [ref=e74]:
            - generic [ref=e75]:
              - generic [ref=e76]: Password
              - link "Forgot password?" [ref=e77] [cursor=pointer]:
                - /url: /forgot-password
            - generic [ref=e78]:
              - textbox "Password" [ref=e79]:
                - /placeholder: Your password
              - button "Show password" [ref=e80] [cursor=pointer]
          - button "Sign in to WorkGrind" [ref=e84] [cursor=pointer]
        - generic [ref=e87]:
          - paragraph [ref=e88]: Demo access
          - generic [ref=e89]:
            - button "Sarah · Owner" [ref=e90] [cursor=pointer]
            - button "Alex · Admin" [ref=e91] [cursor=pointer]
        - paragraph [ref=e92]:
          - text: New to WorkGrind?
          - link "Choose a workspace and get started" [ref=e93] [cursor=pointer]:
            - /url: /signup
        - paragraph [ref=e94]: Protected sign-in · Workspace access is role-based
      - generic [ref=e95]:
        - generic [ref=e96]: © 2026 WorkGrind
        - generic [ref=e97]: For individuals, businesses, and education teams.
  - button "Open Next.js Dev Tools" [ref=e103] [cursor=pointer]
  - alert [ref=e107]
```

# Test source

```ts
  14  |   await expect(page.getByRole('heading', { name: 'Steps to try' })).toBeVisible();
  15  |   await expect(page.getByRole('heading', { name: 'Verify the fix' })).toBeVisible();
  16  | });
  17  | 
  18  | test('Help search matches feature and payment-provider keywords', async ({ page }) => {
  19  |   await page.goto('/help');
  20  |   await page.getByRole('searchbox', { name: 'Search help articles' }).fill('Polar');
  21  |   await expect(page.getByRole('link', { name: /Fix checkout, payment, and cancellation problems/ })).toBeVisible();
  22  |   await expect(page.getByText(/matching “Polar”/)).toBeVisible();
  23  | });
  24  | 
  25  | test('the help index remains usable at a narrow mobile viewport', async ({ page }) => {
  26  |   await page.setViewportSize({ width: 390, height: 844 });
  27  |   await page.goto('/help');
  28  |   await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
  29  |   await expect(page.getByRole('searchbox', { name: 'Search help articles' })).toBeVisible();
  30  |   const widths = await page.evaluate(() => ({
  31  |     viewport: document.documentElement.clientWidth,
  32  |     content: document.documentElement.scrollWidth,
  33  |   }));
  34  |   expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  35  | });
  36  | 
  37  | test('return URLs reject external and protocol-relative destinations', () => {
  38  |   expect(getSafeReturnPath('/tasks?filter=mine')).toBe('/tasks?filter=mine');
  39  |   expect(getSafeReturnPath('https://example.com')).toBeUndefined();
  40  |   expect(getSafeReturnPath('//example.com')).toBeUndefined();
  41  |   expect(getSafeReturnPath('/\\\\example.com')).toBeUndefined();
  42  |   expect(getSafeReturnPath('/login?redirect=%2Ftasks')).toBeUndefined();
  43  |   expect(getWorkspaceSetupDestination('/tasks')).toBe('/create-company?redirect=%2Ftasks');
  44  |   expect(getWorkspaceSetupDestination('/create-company')).toBe('/create-company');
  45  | });
  46  | 
  47  | test('protected destinations show a sign-in prompt with a safe return URL', async ({ page }) => {
  48  |   await page.goto('/help/tasks-and-projects');
  49  |   const signIn = page.getByRole('link', { name: /Sign in to continue/ });
  50  |   await expect(signIn).toHaveAttribute('href', '/login?redirect=%2Ftasks');
  51  |   await signIn.click();
  52  |   await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
  53  |   await expect(page.getByRole('heading', { name: 'Good to have you back.' })).toBeVisible();
  54  | });
  55  | 
  56  | test('a direct protected-route visit preserves the requested path through sign-in', async ({ page }) => {
  57  |   await page.goto('/tasks');
  58  |   await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
  59  | });
  60  | 
  61  | test('successful sign-in returns an existing member to the requested destination', async ({ page }) => {
  62  |   await page.route('**/auth/login', async (route) => {
  63  |     await route.fulfill({
  64  |       status: 200,
  65  |       contentType: 'application/json',
  66  |       body: JSON.stringify({
  67  |         success: true,
  68  |         accessToken: 'help-test-access',
  69  |         user: {
  70  |           _id: 'help-test-user',
  71  |           fullName: 'Help Test',
  72  |           email: 'help-test@example.invalid',
  73  |           role: 'owner',
  74  |           companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
  75  |         },
  76  |       }),
  77  |     });
  78  |   });
  79  |   await page.route('**/auth/me', async (route) => {
  80  |     await route.fulfill({
  81  |       status: 200,
  82  |       contentType: 'application/json',
  83  |       body: JSON.stringify({
  84  |         success: true,
  85  |         user: {
  86  |           _id: 'help-test-user',
  87  |           fullName: 'Help Test',
  88  |           email: 'help-test@example.invalid',
  89  |           role: 'owner',
  90  |           companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
  91  |         },
  92  |       }),
  93  |     });
  94  |   });
  95  |   await page.route('**/subscription/status', async (route) => {
  96  |     await route.fulfill({
  97  |       status: 200,
  98  |       contentType: 'application/json',
  99  |       body: JSON.stringify({
  100 |         success: true,
  101 |         subscription: {
  102 |           status: 'trialing',
  103 |           hasActiveAccess: true,
  104 |           organizationType: 'business',
  105 |           entitlements: { tasksProjects: true },
  106 |           limits: { members: 5, storage: 1_000_000, aiRequests: 50 },
  107 |           usage: { members: 1, storageBytes: 0, aiRequests: 0 },
  108 |         },
  109 |       }),
  110 |     });
  111 |   });
  112 | 
  113 |   await page.goto('/login?redirect=%2Ftasks');
> 114 |   await page.getByLabel('Work email').fill('help-test@example.invalid');
      |                                       ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  115 |   await page.locator('#login-password').fill('not-a-real-secret');
  116 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  117 |   await expect(page).toHaveURL(/\/tasks$/);
  118 | });
  119 | 
  120 | test('every published article has a public route', async ({ request, baseURL }) => {
  121 |   for (const article of HELP_ARTICLES) {
  122 |     const response = await request.get(`${baseURL}/help/${article.slug}`);
  123 |     expect(response.status(), `${article.slug} should be publicly readable`).toBe(200);
  124 |   }
  125 | });
  126 | 
  127 | test('every application destination linked by an article is a real route', async ({ request, baseURL }) => {
  128 |   const paths = [...new Set(HELP_ARTICLES.flatMap((article) => article.appPath ? [article.appPath] : []))];
  129 |   for (const path of paths) {
  130 |     const response = await request.get(`${baseURL}${path}`);
  131 |     expect(response.status(), `${path} should resolve to an application route`).toBe(200);
  132 |   }
  133 | });
  134 | 
```