# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> verified signup creates its workspace with the authenticated owner and stores the rotated access token
- Location: tests\billing-ai-regressions.spec.ts:521:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "Bearer playwright-regression-access"
Received: ""

Call Log:
- Timeout 15000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - img "WorkGrind" [ref=e4]:
      - generic [aria-hidden] [ref=e8]:
        - generic [ref=e9]: Work
        - generic [ref=e10]: Grind
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: 04 WORKSPACE SETUP
        - generic [ref=e19]: Workspace Configuration
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]:
            - heading "Set Up Your Organization Workspace" [level=2] [ref=e23]
            - paragraph [ref=e24]: Create a workspace for your business or educational organization.
          - button "Change Plan" [ref=e25] [cursor=pointer]
        - generic [ref=e29]:
          - generic [ref=e30]: Organization Name
          - textbox "Apex Technologies" [ref=e32]: North School
        - generic [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]: Organization Type
            - combobox [ref=e36]:
              - option "Business"
              - option "School" [selected]
              - option "College"
              - option "University"
          - generic [ref=e37]:
            - generic [ref=e38]: School Type
            - combobox [active] [ref=e39]:
              - option "Select school type" [selected]
              - option "Primary"
              - option "Secondary"
              - option "Combined levels"
              - option "Other"
          - generic [ref=e40]:
            - generic [ref=e41]: Grade or Level Range
            - combobox [ref=e42]:
              - option "Select grade range" [selected]
              - option "Early years"
              - option "Primary"
              - option "Middle school"
              - option "Secondary"
              - option "Multiple levels"
              - option "Other"
          - generic [ref=e43]:
            - generic [ref=e44]: Institution Focus
            - combobox [ref=e45]:
              - option "Education" [selected]
              - option "Technology / SaaS"
              - option "Design & Creative"
              - option "Marketing & Media"
              - option "Finance & Fintech"
              - option "Healthcare"
              - option "E-commerce"
              - option "Other"
          - generic [ref=e46]:
            - generic [ref=e47]: Organization Size
            - combobox [ref=e48]:
              - option "1 - 10 people"
              - option "11 - 50 people" [selected]
              - option "51 - 200 people"
              - option "201 - 500 people"
              - option "500+ people"
        - generic [ref=e49]:
          - generic [ref=e50]:
            - generic [ref=e51]: Country
            - button "🇵🇰 Pakistan" [ref=e53] [cursor=pointer]:
              - generic [ref=e54]:
                - generic [ref=e55]: 🇵🇰
                - generic [ref=e56]: Pakistan
          - generic [ref=e59]:
            - generic [ref=e60]: Time Zone
            - combobox [ref=e61]:
              - option "UTC (GMT+0)" [selected]
              - option "Asia/Karachi (PKT +05:00)"
              - option "Eastern Time (EST)"
              - option "Central Time (CST)"
              - option "Mountain Time (MST)"
              - option "Pacific Time (PST)"
              - option "London (GMT+1)"
              - option "Berlin / Paris (CET)"
              - option "Tokyo (JST)"
              - option "Dubai (GST)"
        - generic [ref=e62]:
          - button "Back" [ref=e63] [cursor=pointer]
          - button "Launch Workspace" [ref=e64] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e73] [cursor=pointer]
  - alert [ref=e77]
```

# Test source

```ts
  493 |       });
  494 |       return;
  495 |     }
  496 |     if (pathname.endsWith('/auth/create-company')) {
  497 |       createCompanyRequests += 1;
  498 |       await route.fulfill({
  499 |         status: 401,
  500 |         contentType: 'application/json',
  501 |         body: JSON.stringify({ success: false, message: 'No token provided' }),
  502 |       });
  503 |       return;
  504 |     }
  505 |     await route.fulfill({
  506 |       status: 200,
  507 |       contentType: 'application/json',
  508 |       body: JSON.stringify({ success: true }),
  509 |     });
  510 |   });
  511 |   await page.goto('/create-company');
  512 | 
  513 |   await page.waitForTimeout(1000);
  514 |   expect(refreshRequests, requestedUrls.join('\n')).toBeGreaterThan(0);
  515 |   await expect(page).toHaveURL(/\/login\?redirect=%2Fcreate-company$/, {
  516 |     timeout: 15000,
  517 |   });
  518 |   expect(createCompanyRequests).toBe(0);
  519 | });
  520 | 
  521 | test('verified signup creates its workspace with the authenticated owner and stores the rotated access token', async ({ page }) => {
  522 |   let createCompanyAuthorization = '';
  523 |   let createCompanyBody: Record<string, unknown> | undefined;
  524 |   await setSessionAuth(page);
  525 |   await page.route('**/api/**', async (route) => {
  526 |     const request = route.request();
  527 |     const pathname = new URL(request.url()).pathname;
  528 |     if (pathname.endsWith('/auth/me')) {
  529 |       await route.fulfill({
  530 |         status: 200,
  531 |         contentType: 'application/json',
  532 |         body: JSON.stringify({
  533 |           success: true,
  534 |           user: {
  535 |             _id: 'signup-owner',
  536 |             fullName: 'School Owner',
  537 |             email: 'school-owner@example.test',
  538 |             role: 'owner',
  539 |             accountType: 'company',
  540 |             signupOrganizationType: 'school',
  541 |             companyId: null,
  542 |           },
  543 |         }),
  544 |       });
  545 |       return;
  546 |     }
  547 |     if (pathname.endsWith('/subscription/status')) {
  548 |       await route.fulfill({
  549 |         status: 200,
  550 |         contentType: 'application/json',
  551 |         body: JSON.stringify({ success: true, subscription: { hasActiveAccess: false } }),
  552 |       });
  553 |       return;
  554 |     }
  555 |     if (pathname.endsWith('/auth/create-company')) {
  556 |       createCompanyAuthorization = request.headers().authorization ?? '';
  557 |       createCompanyBody = request.postDataJSON() as Record<string, unknown>;
  558 |       await route.fulfill({
  559 |         status: 201,
  560 |         contentType: 'application/json',
  561 |         body: JSON.stringify({
  562 |           success: true,
  563 |           accessToken: 'rotated-workspace-access',
  564 |           company: {
  565 |             _id: 'school-workspace',
  566 |             name: 'North School',
  567 |             ownerId: 'signup-owner',
  568 |             organizationType: 'school',
  569 |             accountType: 'company',
  570 |           },
  571 |           user: {
  572 |             _id: 'signup-owner',
  573 |             fullName: 'School Owner',
  574 |             email: 'school-owner@example.test',
  575 |             role: 'owner',
  576 |             accountType: 'company',
  577 |             companyId: 'school-workspace',
  578 |           },
  579 |         }),
  580 |       });
  581 |       return;
  582 |     }
  583 |     await route.fulfill({
  584 |       status: 200,
  585 |       contentType: 'application/json',
  586 |       body: JSON.stringify({ success: true }),
  587 |     });
  588 |   });
  589 |   await page.goto('/create-company');
  590 |   await page.getByPlaceholder('Apex Technologies').fill('North School');
  591 |   await page.getByRole('button', { name: 'Launch Workspace' }).click();
  592 | 
> 593 |   await expect.poll(() => createCompanyAuthorization).toBe('Bearer playwright-regression-access');
      |                                                       ^ Error: expect(received).toBe(expected) // Object.is equality
  594 |   expect(createCompanyAuthorization).toBe('Bearer playwright-regression-access');
  595 |   expect(createCompanyBody).toMatchObject({
  596 |     name: 'North School',
  597 |     accountType: 'company',
  598 |     organizationType: 'school',
  599 |   });
  600 |   await expect.poll(() => page.evaluate(() => sessionStorage.getItem('workgrind_access_token')))
  601 |     .toBe('rotated-workspace-access');
  602 | });
  603 | 
  604 | test('an expired or revoked refresh credential leaves a logged-out visitor on the public landing page', async ({ page }) => {
  605 |   const refreshRequests: number[] = [];
  606 |   const mainFrameNavigations: number[] = [];
  607 |   page.on('framenavigated', (frame) => {
  608 |     if (frame === page.mainFrame()) mainFrameNavigations.push(Date.now());
  609 |   });
  610 |   await page.route('**/api/**', (route) => mockApi(route, {
  611 |     ...makeApiState(),
  612 |     failSubscriptionRequestAt: undefined,
  613 |     failFirstAgentRequest: false,
  614 |     refreshStatus: 401,
  615 |     refreshRequests,
  616 |   }));
  617 | 
  618 |   await page.goto('/');
  619 |   await expect(page).toHaveURL(/\/$/);
  620 |   await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
  621 |   await expect.poll(() => refreshRequests.length).toBe(1);
  622 |   const settledNavigations = mainFrameNavigations.length;
  623 |   await page.waitForTimeout(500);
  624 |   expect(mainFrameNavigations).toHaveLength(settledNavigations);
  625 | });
  626 | 
  627 | test('concurrent expired API requests share one refresh and preserve the current route', async ({ page }) => {
  628 |   test.setTimeout(120_000);
  629 |   const state = makeApiState();
  630 |   state.messages.push({
  631 |     role: 'assistant',
  632 |     content: 'Restored conversation',
  633 |     createdAt: new Date().toISOString(),
  634 |   });
  635 |   const refreshRequests: number[] = [];
  636 |   const unauthorizedPaths = new Map([
  637 |     ['/subscription/status', 1],
  638 |     [`/ai/agent/conversations/${conversationId}`, 1],
  639 |   ]);
  640 |   await page.addInitScript((id) => {
  641 |     sessionStorage.setItem('workgrind_access_token', 'playwright-expired-access');
  642 |     sessionStorage.setItem('workgrind:ai:active-conversation:playwright-user', id);
  643 |   }, conversationId);
  644 |   await page.routeWebSocket('**/socket.io/**', (socket) => {
  645 |     socket.close({ code: 1000, reason: 'Socket.IO is not under test.' });
  646 |   });
  647 |   await page.route('**/api/**', (route) => mockApi(route, {
  648 |     ...state,
  649 |     failSubscriptionRequestAt: undefined,
  650 |     failFirstAgentRequest: false,
  651 |     refreshDelayMs: 150,
  652 |     refreshRequests,
  653 |     unauthorizedPaths,
  654 |   }));
  655 |   await page.goto('/ai');
  656 | 
  657 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  658 |   await expect(page.getByText('Restored conversation')).toBeVisible();
  659 |   expect(refreshRequests).toHaveLength(1);
  660 |   await expect(page).toHaveURL(/\/ai$/);
  661 | });
  662 | 
  663 | test('login 401 is not retried with a stale access token', async ({ page }) => {
  664 |   const refreshRequests: number[] = [];
  665 |   let loginRequests = 0;
  666 |   await page.route('**/api/**', async (route) => {
  667 |     const pathname = new URL(route.request().url()).pathname;
  668 |     if (pathname.endsWith('/auth/login')) {
  669 |       loginRequests += 1;
  670 |       await route.fulfill({
  671 |         status: 401,
  672 |         contentType: 'application/json',
  673 |         body: JSON.stringify({ success: false, message: 'Invalid credentials.' }),
  674 |       });
  675 |       return;
  676 |     }
  677 |     await mockApi(route, {
  678 |       ...makeApiState(),
  679 |       failSubscriptionRequestAt: undefined,
  680 |       failFirstAgentRequest: false,
  681 |       refreshStatus: 401,
  682 |       refreshRequests,
  683 |     });
  684 |   });
  685 |   await page.goto('/login');
  686 |   await page.getByLabel('Email address').fill('invalid@example.invalid');
  687 |   await expect.poll(() => refreshRequests.length).toBe(1);
  688 |   await page.evaluate(() => {
  689 |     sessionStorage.setItem('workgrind_access_token', 'playwright-stale-access');
  690 |   });
  691 |   await page.locator('#login-password').fill('not-a-real-secret');
  692 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  693 | 
```