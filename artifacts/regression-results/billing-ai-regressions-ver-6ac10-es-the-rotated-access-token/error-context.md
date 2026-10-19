# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> verified signup creates its workspace with the authenticated owner and stores the rotated access token
- Location: tests\billing-ai-regressions.spec.ts:471:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/onboarding$/
Received string:  "http://127.0.0.1:3101/login?redirect=%2Fcreate-company"
Timeout: 15000ms

Call log:
  - Expect "toHaveURL" with timeout 15000ms
    13 × locator resolved to <html lang="en" dir="ltr" data-theme="original" class="plus_jakarta_sans_f1fa6da1-module__6F21nW__variable">…</html>
       - unexpected value "http://127.0.0.1:3101/create-company"
    19 × locator resolved to <html lang="en" dir="ltr" data-theme="original" class="plus_jakarta_sans_f1fa6da1-module__6F21nW__variable">…</html>
       - unexpected value "http://127.0.0.1:3101/login?redirect=%2Fcreate-company"

```

```yaml
- alert
- main:
  - complementary "WorkGrind workspace preview":
    - img "WorkGrind"
    - text: WORK, IN GOOD ORDER.
    - paragraph: FOR WORK, BUSINESS, AND LEARNING
    - heading "One workspace for work and learning." [level=2]
    - paragraph: Personal planning, team collaboration, and academic administration, with Tavro AI for work and learning where available.
    - text: MONDAY / OVERVIEW SAMPLE Good morning, team.
    - strong: Launch planning
    - text: Product / Due today AM
    - strong: Review Q3 pipeline
    - text: Sales / In progress JL FOCUS BLOCK
    - strong: 2h 40m
    - paragraph: For individuals, organizations, and education teams.
  - paragraph: YOUR WORKSPACE AWAITS
  - heading "Good to have you back." [level=1]
  - paragraph: Sign in to continue in your WorkGrind workspace.
  - button "Continue with Google"
  - button "Continue with LinkedIn"
  - text: or sign in with email Email address
  - textbox "Email address":
    - /placeholder: you@example.com
  - text: Password
  - link "Forgot password?":
    - /url: /forgot-password
  - textbox "Password":
    - /placeholder: Your password
  - button "Show password"
  - button "Sign in to WorkGrind"
  - paragraph: Demo access
  - button "Sarah · Owner"
  - button "Alex · Admin"
  - paragraph:
    - text: New to WorkGrind?
    - link "Choose a workspace and get started":
      - /url: /signup
  - paragraph: Protected sign-in · Workspace access is role-based
  - text: © 2026 WorkGrind For individuals, businesses, and education teams.
```

# Test source

```ts
  443 |       });
  444 |       return;
  445 |     }
  446 |     if (pathname.endsWith('/auth/create-company')) {
  447 |       createCompanyRequests += 1;
  448 |       await route.fulfill({
  449 |         status: 401,
  450 |         contentType: 'application/json',
  451 |         body: JSON.stringify({ success: false, message: 'No token provided' }),
  452 |       });
  453 |       return;
  454 |     }
  455 |     await route.fulfill({
  456 |       status: 200,
  457 |       contentType: 'application/json',
  458 |       body: JSON.stringify({ success: true }),
  459 |     });
  460 |   });
  461 |   await page.goto('/create-company');
  462 | 
  463 |   await page.waitForTimeout(1000);
  464 |   expect(refreshRequests, requestedUrls.join('\n')).toBeGreaterThan(0);
  465 |   await expect(page).toHaveURL(/\/login\?redirect=%2Fcreate-company$/, {
  466 |     timeout: 15000,
  467 |   });
  468 |   expect(createCompanyRequests).toBe(0);
  469 | });
  470 | 
  471 | test('verified signup creates its workspace with the authenticated owner and stores the rotated access token', async ({ page }) => {
  472 |   let createCompanyAuthorization = '';
  473 |   let createCompanyBody: Record<string, unknown> | undefined;
  474 |   await setSessionAuth(page);
  475 |   await page.route('**/api/**', async (route) => {
  476 |     const request = route.request();
  477 |     const pathname = new URL(request.url()).pathname;
  478 |     if (pathname.endsWith('/auth/me')) {
  479 |       await route.fulfill({
  480 |         status: 200,
  481 |         contentType: 'application/json',
  482 |         body: JSON.stringify({
  483 |           success: true,
  484 |           user: {
  485 |             _id: 'signup-owner',
  486 |             fullName: 'School Owner',
  487 |             email: 'school-owner@example.test',
  488 |             role: 'owner',
  489 |             accountType: 'company',
  490 |             signupOrganizationType: 'school',
  491 |             companyId: null,
  492 |           },
  493 |         }),
  494 |       });
  495 |       return;
  496 |     }
  497 |     if (pathname.endsWith('/subscription/status')) {
  498 |       await route.fulfill({
  499 |         status: 200,
  500 |         contentType: 'application/json',
  501 |         body: JSON.stringify({ success: true, subscription: { hasActiveAccess: true } }),
  502 |       });
  503 |       return;
  504 |     }
  505 |     if (pathname.endsWith('/auth/create-company')) {
  506 |       createCompanyAuthorization = request.headers().authorization ?? '';
  507 |       createCompanyBody = request.postDataJSON() as Record<string, unknown>;
  508 |       await route.fulfill({
  509 |         status: 201,
  510 |         contentType: 'application/json',
  511 |         body: JSON.stringify({
  512 |           success: true,
  513 |           accessToken: 'rotated-workspace-access',
  514 |           company: {
  515 |             _id: 'school-workspace',
  516 |             name: 'North School',
  517 |             ownerId: 'signup-owner',
  518 |             organizationType: 'school',
  519 |             accountType: 'company',
  520 |           },
  521 |           user: {
  522 |             _id: 'signup-owner',
  523 |             fullName: 'School Owner',
  524 |             email: 'school-owner@example.test',
  525 |             role: 'owner',
  526 |             accountType: 'company',
  527 |             companyId: 'school-workspace',
  528 |           },
  529 |         }),
  530 |       });
  531 |       return;
  532 |     }
  533 |     await route.fulfill({
  534 |       status: 200,
  535 |       contentType: 'application/json',
  536 |       body: JSON.stringify({ success: true }),
  537 |     });
  538 |   });
  539 |   await page.goto('/create-company');
  540 |   await page.getByPlaceholder('Apex Technologies').fill('North School');
  541 |   await page.getByRole('button', { name: 'Launch Workspace' }).click();
  542 | 
> 543 |   await expect(page).toHaveURL(/\/onboarding$/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  544 |   expect(createCompanyAuthorization).toBe('Bearer playwright-regression-access');
  545 |   expect(createCompanyBody).toMatchObject({
  546 |     name: 'North School',
  547 |     accountType: 'company',
  548 |     organizationType: 'school',
  549 |   });
  550 |   await expect.poll(() => page.evaluate(() => sessionStorage.getItem('workgrind_access_token')))
  551 |     .toBe('rotated-workspace-access');
  552 | });
  553 | 
  554 | test('an expired or revoked refresh credential leaves a logged-out visitor on the public landing page', async ({ page }) => {
  555 |   const refreshRequests: number[] = [];
  556 |   const mainFrameNavigations: number[] = [];
  557 |   page.on('framenavigated', (frame) => {
  558 |     if (frame === page.mainFrame()) mainFrameNavigations.push(Date.now());
  559 |   });
  560 |   await page.route('**/api/**', (route) => mockApi(route, {
  561 |     ...makeApiState(),
  562 |     failSubscriptionRequestAt: undefined,
  563 |     failFirstAgentRequest: false,
  564 |     refreshStatus: 401,
  565 |     refreshRequests,
  566 |   }));
  567 | 
  568 |   await page.goto('/');
  569 |   await expect(page).toHaveURL(/\/$/);
  570 |   await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
  571 |   await page.waitForTimeout(500);
  572 |   expect(refreshRequests).toHaveLength(1);
  573 |   expect(mainFrameNavigations).toHaveLength(1);
  574 | });
  575 | 
  576 | test('concurrent expired API requests share one refresh and preserve the current route', async ({ page }) => {
  577 |   const state = makeApiState();
  578 |   state.messages.push({
  579 |     role: 'assistant',
  580 |     content: 'Restored conversation',
  581 |     createdAt: new Date().toISOString(),
  582 |   });
  583 |   const refreshRequests: number[] = [];
  584 |   const unauthorizedPaths = new Map([
  585 |     ['/subscription/status', 1],
  586 |     [`/ai/agent/conversations/${conversationId}`, 1],
  587 |   ]);
  588 |   await page.addInitScript((id) => {
  589 |     sessionStorage.setItem('workgrind_access_token', 'playwright-expired-access');
  590 |     sessionStorage.setItem('workgrind:ai:active-conversation:playwright-user', id);
  591 |   }, conversationId);
  592 |   await page.route('**/api/**', (route) => mockApi(route, {
  593 |     ...state,
  594 |     failSubscriptionRequestAt: undefined,
  595 |     failFirstAgentRequest: false,
  596 |     refreshDelayMs: 150,
  597 |     refreshRequests,
  598 |     unauthorizedPaths,
  599 |   }));
  600 |   await page.goto('/ai');
  601 | 
  602 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  603 |   await expect(page.getByText('Restored conversation')).toBeVisible();
  604 |   expect(refreshRequests).toHaveLength(1);
  605 |   await expect(page).toHaveURL(/\/ai$/);
  606 | });
  607 | 
  608 | test('login 401 is not retried with a stale access token', async ({ page }) => {
  609 |   const refreshRequests: number[] = [];
  610 |   let loginRequests = 0;
  611 |   await page.route('**/api/**', async (route) => {
  612 |     const pathname = new URL(route.request().url()).pathname;
  613 |     if (pathname.endsWith('/auth/login')) {
  614 |       loginRequests += 1;
  615 |       await route.fulfill({
  616 |         status: 401,
  617 |         contentType: 'application/json',
  618 |         body: JSON.stringify({ success: false, message: 'Invalid credentials.' }),
  619 |       });
  620 |       return;
  621 |     }
  622 |     await mockApi(route, {
  623 |       ...makeApiState(),
  624 |       failSubscriptionRequestAt: undefined,
  625 |       failFirstAgentRequest: false,
  626 |       refreshStatus: 401,
  627 |       refreshRequests,
  628 |     });
  629 |   });
  630 |   await page.goto('/login');
  631 |   await page.getByLabel('Email address').fill('invalid@example.invalid');
  632 |   await expect.poll(() => refreshRequests.length).toBe(1);
  633 |   await page.evaluate(() => {
  634 |     sessionStorage.setItem('workgrind_access_token', 'playwright-stale-access');
  635 |   });
  636 |   await page.locator('#login-password').fill('not-a-real-secret');
  637 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  638 | 
  639 |   await expect(page.locator('.auth-error[role="alert"]')).toContainText('Invalid credentials.');
  640 |   expect(loginRequests).toBe(1);
  641 |   expect(refreshRequests).toHaveLength(1);
  642 |   await expect(page).toHaveURL(/\/login$/);
  643 | });
```