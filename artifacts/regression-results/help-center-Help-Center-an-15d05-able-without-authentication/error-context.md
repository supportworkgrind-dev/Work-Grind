# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: help-center.spec.ts >> Help Center and published articles are readable without authentication
- Location: tests\help-center.spec.ts:4:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('textbox', { name: 'Search help articles' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('textbox', { name: 'Search help articles' }) with timeout 15000ms
  - waiting for getByRole('textbox', { name: 'Search help articles' })

```

```yaml
- banner:
  - link "WorkGrind home":
    - /url: /
    - img "WorkGrind"
  - button "Select language": English
  - link "Sign In":
    - /url: /login
  - link "Get Started":
    - /url: /signup
- main:
  - navigation "Breadcrumb":
    - link "Home":
      - /url: /
    - text: /Help Center
  - text: WorkGrind Help Center
  - heading "How can we help?" [level=1]
  - paragraph: Search practical setup and troubleshooting guides for Solo, Company, School / Academy, College, and University workspaces. Articles are public; application access still depends on sign-in and your permissions.
  - text: Search help articles
  - searchbox "Search help articles"
  - region "Popular guides":
    - heading "Popular guides" [level=2]
    - link "Create an account and set up your workspace Read guide":
      - /url: /help/getting-started
    - link "Choose Solo, Company, School, College, or University Read guide":
      - /url: /help/choose-the-right-workspace
    - link "Manage roles, invitations, and workspace members Read guide":
      - /url: /help/roles-invitations-and-members
    - link "Review subscription, plan limits, and billing access Read guide":
      - /url: /help/billing-and-subscriptions
  - region "Browse guides":
    - heading "Browse guides" [level=2]
    - paragraph: 24 guides
    - button "All guides" [pressed]
    - button "Accounts and setup"
    - button "Workspace guides"
    - button "Education guides"
    - button "Access and security"
    - button "Work and collaboration"
    - button "Company guides"
    - button "Billing"
    - button "Troubleshooting"
    - button "Help and troubleshooting"
    - link "Accounts and setup Create an account and set up your workspace Choose a workspace type, verify your email, and get through initial setup. All workspaces":
      - /url: /help/getting-started
      - text: Accounts and setup
      - heading "Create an account and set up your workspace" [level=3]
      - paragraph: Choose a workspace type, verify your email, and get through initial setup.
      - paragraph: All workspaces
    - link "Accounts and setup Sign in and recover access to your account Resolve common login problems and request a password reset. All workspaces":
      - /url: /help/login-and-password-recovery
      - text: Accounts and setup
      - heading "Sign in and recover access to your account" [level=3]
      - paragraph: Resolve common login problems and request a password reset.
      - paragraph: All workspaces
    - link "Accounts and setup Choose Solo, Company, School, College, or University Understand the workspace types and why features differ between them. All workspaces":
      - /url: /help/choose-the-right-workspace
      - text: Accounts and setup
      - heading "Choose Solo, Company, School, College, or University" [level=3]
      - paragraph: Understand the workspace types and why features differ between them.
      - paragraph: All workspaces
    - link "Workspace guides Set up a Solo workspace Start using personal focus, tasks, planning, documents, and supported AI tools. Solo":
      - /url: /help/solo-workspace-setup
      - text: Workspace guides
      - heading "Set up a Solo workspace" [level=3]
      - paragraph: Start using personal focus, tasks, planning, documents, and supported AI tools.
      - paragraph: Solo
    - link "Workspace guides Set up a Company workspace Create a company workspace, invite team members, and understand business-only areas. Company":
      - /url: /help/company-workspace-setup
      - text: Workspace guides
      - heading "Set up a Company workspace" [level=3]
      - paragraph: Create a company workspace, invite team members, and understand business-only areas.
      - paragraph: Company
    - link "Education guides Set up a School, College, or University Select the institution type and prepare the academic workspace for authorized staff. School / Academy · College · University":
      - /url: /help/education-workspace-setup
      - text: Education guides
      - heading "Set up a School, College, or University" [level=3]
      - paragraph: Select the institution type and prepare the academic workspace for authorized staff.
      - paragraph: School / Academy · College · University
    - link "Access and security Manage roles, invitations, and workspace members Understand role eligibility, invitees, and who can change workspace access. All workspaces":
      - /url: /help/roles-invitations-and-members
      - text: Access and security
      - heading "Manage roles, invitations, and workspace members" [level=3]
      - paragraph: Understand role eligibility, invitees, and who can change workspace access.
      - paragraph: All workspaces
    - link "Access and security Fix an access denied or missing feature message Check workspace, role, subscription, and assignment before retrying. All workspaces":
      - /url: /help/access-denied
      - text: Access and security
      - heading "Fix an access denied or missing feature message" [level=3]
      - paragraph: Check workspace, role, subscription, and assignment before retrying.
      - paragraph: All workspaces
    - link "Work and collaboration Create and organize tasks and projects Use tasks and projects where your workspace type and role provide access. Solo · Company":
      - /url: /help/tasks-and-projects
      - text: Work and collaboration
      - heading "Create and organize tasks and projects" [level=3]
      - paragraph: Use tasks and projects where your workspace type and role provide access.
      - paragraph: Solo · Company
    - link "Work and collaboration Use the calendar and join a meeting Troubleshoot event visibility, meeting links, and browser access. All workspaces":
      - /url: /help/calendar-and-meetings
      - text: Work and collaboration
      - heading "Use the calendar and join a meeting" [level=3]
      - paragraph: Troubleshoot event visibility, meeting links, and browser access.
      - paragraph: All workspaces
    - link "Company guides Use CRM and Client Portal features Understand where business customer records and client collaboration belong. Company":
      - /url: /help/crm-and-client-portal
      - text: Company guides
      - heading "Use CRM and Client Portal features" [level=3]
      - paragraph: Understand where business customer records and client collaboration belong.
      - paragraph: Company
    - link "Work and collaboration Troubleshoot chat and Global Calling Resolve message delivery, presence, Calling ID lookup, and call connection issues. All workspaces":
      - /url: /help/chat-and-global-calling
      - text: Work and collaboration
      - heading "Troubleshoot chat and Global Calling" [level=3]
      - paragraph: Resolve message delivery, presence, Calling ID lookup, and call connection issues.
      - paragraph: All workspaces
    - link "Work and collaboration Upload files and work with documents or sheets Check permissions, file size, network state, and storage when uploads fail. All workspaces":
      - /url: /help/files-documents-and-sheets
      - text: Work and collaboration
      - heading "Upload files and work with documents or sheets" [level=3]
      - paragraph: Check permissions, file size, network state, and storage when uploads fail.
      - paragraph: All workspaces
    - link "Education guides Manage students, teachers, faculty, and guardians Keep education records in the right institution and link guardians only through authorized records. School / Academy · College · University":
      - /url: /help/education-people-and-guardians
      - text: Education guides
      - heading "Manage students, teachers, faculty, and guardians" [level=3]
      - paragraph: Keep education records in the right institution and link guardians only through authorized records.
      - paragraph: School / Academy · College · University
    - link "Education guides Set up departments, courses, and classes Keep academic structure consistent and ensure linked records belong to your institution. College · University":
      - /url: /help/departments-courses-and-classes
      - text: Education guides
      - heading "Set up departments, courses, and classes" [level=3]
      - paragraph: Keep academic structure consistent and ensure linked records belong to your institution.
      - paragraph: College · University
    - link "Education guides Work with timetables, assignments, and attendance Check class assignments and dates when schedules or learning records are missing. School / Academy · College · University":
      - /url: /help/timetables-assignments-and-attendance
      - text: Education guides
      - heading "Work with timetables, assignments, and attendance" [level=3]
      - paragraph: Check class assignments and dates when schedules or learning records are missing.
      - paragraph: School / Academy · College · University
    - link "Education guides Troubleshoot exams, results, and fees Find the right academic record and protect confidential grade and financial information. School / Academy · College · University":
      - /url: /help/exams-results-and-fees
      - text: Education guides
      - heading "Troubleshoot exams, results, and fees" [level=3]
      - paragraph: Find the right academic record and protect confidential grade and financial information.
      - paragraph: School / Academy · College · University
    - link "Billing Review subscription, plan limits, and billing access Understand workspace plan status, role limits, and organization-specific pricing. All workspaces":
      - /url: /help/billing-and-subscriptions
      - text: Billing
      - heading "Review subscription, plan limits, and billing access" [level=3]
      - paragraph: Understand workspace plan status, role limits, and organization-specific pricing.
      - paragraph: All workspaces
    - link "Billing Fix checkout, payment, and cancellation problems Handle provider errors safely and confirm subscription changes from Billing. All workspaces":
      - /url: /help/checkout-failed-payment-and-cancellation
      - text: Billing
      - heading "Fix checkout, payment, and cancellation problems" [level=3]
      - paragraph: Handle provider errors safely and confirm subscription changes from Billing.
      - paragraph: All workspaces
    - link "Billing Understand trial expiry and restricted workspace access Check trial status and restore access through the workspace billing owner. All workspaces":
      - /url: /help/trial-expiry-and-restricted-access
      - text: Billing
      - heading "Understand trial expiry and restricted workspace access" [level=3]
      - paragraph: Check trial status and restore access through the workspace billing owner.
      - paragraph: All workspaces
    - link "Troubleshooting Troubleshoot Tavro AI text and voice Check access, request context, connectivity, and microphone permissions. All workspaces":
      - /url: /help/tavro-ai-and-voice-troubleshooting
      - text: Troubleshooting
      - heading "Troubleshoot Tavro AI text and voice" [level=3]
      - paragraph: Check access, request context, connectivity, and microphone permissions.
      - paragraph: All workspaces
    - link "Troubleshooting Fix upload, notification, or live-update problems Check connection state, browser settings, and the relevant workspace limit. All workspaces":
      - /url: /help/uploads-notifications-and-realtime
      - text: Troubleshooting
      - heading "Fix upload, notification, or live-update problems" [level=3]
      - paragraph: Check connection state, browser settings, and the relevant workspace limit.
      - paragraph: All workspaces
    - link "Access and security Protect your account and recover safely Use safe recovery practices and report suspected unauthorized access. All workspaces":
      - /url: /help/privacy-security-and-account-recovery
      - text: Access and security
      - heading "Protect your account and recover safely" [level=3]
      - paragraph: Use safe recovery practices and report suspected unauthorized access.
      - paragraph: All workspaces
    - link "Help and troubleshooting Contact support with a useful error report Collect enough diagnostic detail to investigate without exposing secrets or private records. All workspaces":
      - /url: /help/contact-support-and-report-an-error
      - text: Help and troubleshooting
      - heading "Contact support with a useful error report" [level=3]
      - paragraph: Collect enough diagnostic detail to investigate without exposing secrets or private records.
      - paragraph: All workspaces
  - heading "Frequently asked questions" [level=2]
  - group: Do I need to sign in to read Help Center articles? +
  - group: Why do my menus differ from a guide? +
  - group: Who can manage billing? +
  - group: Can support troubleshoot private student or client records? +
  - complementary:
    - heading "Still stuck?" [level=2]
    - paragraph: Send support the page URL, exact error, browser, and steps to reproduce. Keep passwords, access tokens, payment details, and private records out of the report.
    - button "Copy error-report template"
    - link "Contact support":
      - /url: /contact?subject=Technical%20Support
    - paragraph:
      - text: The public contact form does not require sign-in. For protected workspace actions,
      - link "sign in and return to support":
        - /url: /login?redirect=%2Fsupport
      - text: .
- contentinfo:
  - img "WorkGrind"
  - paragraph: A connected workspace for personal work, business, and education.
  - link "Follow WorkGrind on Instagram":
    - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
    - img
  - heading "Company" [level=3]
  - list:
    - listitem:
      - link "About":
        - /url: /about
    - listitem:
      - link "Features":
        - /url: /features
    - listitem:
      - link "Demo":
        - /url: /demo
    - listitem:
      - link "Contact":
        - /url: /contact
  - heading "Legal" [level=3]
  - list:
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy
    - listitem:
      - link "Terms of Service":
        - /url: /terms
    - listitem:
      - link "Cookie Preferences":
        - /url: /cookies
    - listitem:
      - link "Refund Policy":
        - /url: /refunds
    - listitem:
      - link "Cancellation Policy":
        - /url: /cancellation
    - listitem:
      - link "Disclaimer":
        - /url: /disclaimer
  - heading "Trust & Security" [level=3]
  - list:
    - listitem:
      - link "Security":
        - /url: /security
    - listitem:
      - link "Responsible Disclosure":
        - /url: /responsible-disclosure
    - listitem:
      - link "Accessibility":
        - /url: /accessibility
    - listitem:
      - link "Data Processing Agreement":
        - /url: /dpa
    - listitem:
      - link "Acceptable Use":
        - /url: /acceptable-use
    - listitem:
      - link "Community Guidelines":
        - /url: /community-guidelines
  - heading "Support" [level=3]
  - list:
    - listitem:
      - link "Help Center":
        - /url: /help
    - listitem:
      - link "Support":
        - /url: /support
  - paragraph: © 2026 WorkGrind. All rights reserved.
  - button "Select language": English
- alert
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { HELP_ARTICLES } from '../src/lib/helpArticles';
  3   | 
  4   | test('Help Center and published articles are readable without authentication', async ({ page }) => {
  5   |   await page.goto('/help');
  6   |   await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
> 7   |   await expect(page.getByRole('textbox', { name: 'Search help articles' })).toBeVisible();
      |                                                                             ^ Error: expect(locator).toBeVisible() failed
  8   | 
  9   |   await page.goto('/help/getting-started');
  10  |   await expect(page.getByRole('heading', { name: 'Create an account and set up your workspace' })).toBeVisible();
  11  |   await expect(page.getByRole('heading', { name: 'Symptoms' })).toBeVisible();
  12  |   await expect(page.getByRole('heading', { name: 'Likely causes' })).toBeVisible();
  13  |   await expect(page.getByRole('heading', { name: 'Steps to try' })).toBeVisible();
  14  |   await expect(page.getByRole('heading', { name: 'Verify the fix' })).toBeVisible();
  15  | });
  16  | 
  17  | test('Help search matches feature and payment-provider keywords', async ({ page }) => {
  18  |   await page.goto('/help');
  19  |   await page.getByRole('textbox', { name: 'Search help articles' }).fill('Polar');
  20  |   await expect(page.getByRole('link', { name: /Fix checkout, payment, and cancellation problems/ })).toBeVisible();
  21  |   await expect(page.getByText(/matching “Polar”/)).toBeVisible();
  22  | });
  23  | 
  24  | test('protected destinations show a sign-in prompt with a safe return URL', async ({ page }) => {
  25  |   await page.goto('/help/tasks-and-projects');
  26  |   const signIn = page.getByRole('link', { name: /Sign in to continue/ });
  27  |   await expect(signIn).toHaveAttribute('href', '/login?redirect=%2Ftasks');
  28  |   await signIn.click();
  29  |   await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
  30  |   await expect(page.getByRole('heading', { name: 'Good to have you back.' })).toBeVisible();
  31  | });
  32  | 
  33  | test('a direct protected-route visit preserves the requested path through sign-in', async ({ page }) => {
  34  |   await page.goto('/tasks');
  35  |   await expect(page).toHaveURL(/\/login\?redirect=%2Ftasks$/);
  36  | });
  37  | 
  38  | test('successful sign-in returns an existing member to the requested destination', async ({ page }) => {
  39  |   await page.route('**/auth/login', async (route) => {
  40  |     await route.fulfill({
  41  |       status: 200,
  42  |       contentType: 'application/json',
  43  |       body: JSON.stringify({
  44  |         success: true,
  45  |         accessToken: 'help-test-access',
  46  |         user: {
  47  |           _id: 'help-test-user',
  48  |           fullName: 'Help Test',
  49  |           email: 'help-test@example.invalid',
  50  |           role: 'owner',
  51  |           companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
  52  |         },
  53  |       }),
  54  |     });
  55  |   });
  56  |   await page.route('**/auth/me', async (route) => {
  57  |     await route.fulfill({
  58  |       status: 200,
  59  |       contentType: 'application/json',
  60  |       body: JSON.stringify({
  61  |         success: true,
  62  |         user: {
  63  |           _id: 'help-test-user',
  64  |           fullName: 'Help Test',
  65  |           email: 'help-test@example.invalid',
  66  |           role: 'owner',
  67  |           companyId: { _id: 'help-test-company', name: 'Help Test Company', organizationType: 'business', accountType: 'company' },
  68  |         },
  69  |       }),
  70  |     });
  71  |   });
  72  |   await page.route('**/subscription/status', async (route) => {
  73  |     await route.fulfill({
  74  |       status: 200,
  75  |       contentType: 'application/json',
  76  |       body: JSON.stringify({
  77  |         success: true,
  78  |         subscription: {
  79  |           status: 'trialing',
  80  |           hasActiveAccess: true,
  81  |           organizationType: 'business',
  82  |           entitlements: { tasksProjects: true },
  83  |           limits: { members: 5, storage: 1_000_000, aiRequests: 50 },
  84  |           usage: { members: 1, storageBytes: 0, aiRequests: 0 },
  85  |         },
  86  |       }),
  87  |     });
  88  |   });
  89  | 
  90  |   await page.goto('/login?redirect=%2Ftasks');
  91  |   await page.getByLabel('Work email').fill('help-test@example.invalid');
  92  |   await page.getByLabel('Password').fill('not-a-real-secret');
  93  |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  94  |   await expect(page).toHaveURL(/\/tasks$/);
  95  | });
  96  | 
  97  | test('every published article has a public route', async ({ request, baseURL }) => {
  98  |   for (const article of HELP_ARTICLES) {
  99  |     const response = await request.get(`${baseURL}/help/${article.slug}`);
  100 |     expect(response.status(), `${article.slug} should be publicly readable`).toBe(200);
  101 |   }
  102 | });
  103 | 
```