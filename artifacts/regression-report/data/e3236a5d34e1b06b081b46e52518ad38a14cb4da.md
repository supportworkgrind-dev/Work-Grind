# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> verified signup creates its workspace with the authenticated owner and stores the rotated access token
- Location: tests\billing-ai-regressions.spec.ts:516:5

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
  488 |       });
  489 |       return;
  490 |     }
  491 |     if (pathname.endsWith('/auth/create-company')) {
  492 |       createCompanyRequests += 1;
  493 |       await route.fulfill({
  494 |         status: 401,
  495 |         contentType: 'application/json',
  496 |         body: JSON.stringify({ success: false, message: 'No token provided' }),
  497 |       });
  498 |       return;
  499 |     }
  500 |     await route.fulfill({
  501 |       status: 200,
  502 |       contentType: 'application/json',
  503 |       body: JSON.stringify({ success: true }),
  504 |     });
  505 |   });
  506 |   await page.goto('/create-company');
  507 | 
  508 |   await page.waitForTimeout(1000);
  509 |   expect(refreshRequests, requestedUrls.join('\n')).toBeGreaterThan(0);
  510 |   await expect(page).toHaveURL(/\/login\?redirect=%2Fcreate-company$/, {
  511 |     timeout: 15000,
  512 |   });
  513 |   expect(createCompanyRequests).toBe(0);
  514 | });
  515 | 
  516 | test('verified signup creates its workspace with the authenticated owner and stores the rotated access token', async ({ page }) => {
  517 |   let createCompanyAuthorization = '';
  518 |   let createCompanyBody: Record<string, unknown> | undefined;
  519 |   await setSessionAuth(page);
  520 |   await page.route('**/api/**', async (route) => {
  521 |     const request = route.request();
  522 |     const pathname = new URL(request.url()).pathname;
  523 |     if (pathname.endsWith('/auth/me')) {
  524 |       await route.fulfill({
  525 |         status: 200,
  526 |         contentType: 'application/json',
  527 |         body: JSON.stringify({
  528 |           success: true,
  529 |           user: {
  530 |             _id: 'signup-owner',
  531 |             fullName: 'School Owner',
  532 |             email: 'school-owner@example.test',
  533 |             role: 'owner',
  534 |             accountType: 'company',
  535 |             signupOrganizationType: 'school',
  536 |             companyId: null,
  537 |           },
  538 |         }),
  539 |       });
  540 |       return;
  541 |     }
  542 |     if (pathname.endsWith('/subscription/status')) {
  543 |       await route.fulfill({
  544 |         status: 200,
  545 |         contentType: 'application/json',
  546 |         body: JSON.stringify({ success: true, subscription: { hasActiveAccess: false } }),
  547 |       });
  548 |       return;
  549 |     }
  550 |     if (pathname.endsWith('/auth/create-company')) {
  551 |       createCompanyAuthorization = request.headers().authorization ?? '';
  552 |       createCompanyBody = request.postDataJSON() as Record<string, unknown>;
  553 |       await route.fulfill({
  554 |         status: 201,
  555 |         contentType: 'application/json',
  556 |         body: JSON.stringify({
  557 |           success: true,
  558 |           accessToken: 'rotated-workspace-access',
  559 |           company: {
  560 |             _id: 'school-workspace',
  561 |             name: 'North School',
  562 |             ownerId: 'signup-owner',
  563 |             organizationType: 'school',
  564 |             accountType: 'company',
  565 |           },
  566 |           user: {
  567 |             _id: 'signup-owner',
  568 |             fullName: 'School Owner',
  569 |             email: 'school-owner@example.test',
  570 |             role: 'owner',
  571 |             accountType: 'company',
  572 |             companyId: 'school-workspace',
  573 |           },
  574 |         }),
  575 |       });
  576 |       return;
  577 |     }
  578 |     await route.fulfill({
  579 |       status: 200,
  580 |       contentType: 'application/json',
  581 |       body: JSON.stringify({ success: true }),
  582 |     });
  583 |   });
  584 |   await page.goto('/create-company');
  585 |   await page.getByPlaceholder('Apex Technologies').fill('North School');
  586 |   await page.getByRole('button', { name: 'Launch Workspace' }).click();
  587 | 
> 588 |   await expect.poll(() => createCompanyAuthorization).toBe('Bearer playwright-regression-access');
      |                                                       ^ Error: expect(received).toBe(expected) // Object.is equality
  589 |   expect(createCompanyAuthorization).toBe('Bearer playwright-regression-access');
  590 |   expect(createCompanyBody).toMatchObject({
  591 |     name: 'North School',
  592 |     accountType: 'company',
  593 |     organizationType: 'school',
  594 |   });
  595 |   await expect.poll(() => page.evaluate(() => sessionStorage.getItem('workgrind_access_token')))
  596 |     .toBe('rotated-workspace-access');
  597 | });
  598 | 
  599 | test('an expired or revoked refresh credential leaves a logged-out visitor on the public landing page', async ({ page }) => {
  600 |   const refreshRequests: number[] = [];
  601 |   const mainFrameNavigations: number[] = [];
  602 |   page.on('framenavigated', (frame) => {
  603 |     if (frame === page.mainFrame()) mainFrameNavigations.push(Date.now());
  604 |   });
  605 |   await page.route('**/api/**', (route) => mockApi(route, {
  606 |     ...makeApiState(),
  607 |     failSubscriptionRequestAt: undefined,
  608 |     failFirstAgentRequest: false,
  609 |     refreshStatus: 401,
  610 |     refreshRequests,
  611 |   }));
  612 | 
  613 |   await page.goto('/');
  614 |   await expect(page).toHaveURL(/\/$/);
  615 |   await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
  616 |   await expect.poll(() => refreshRequests.length).toBe(1);
  617 |   const settledNavigations = mainFrameNavigations.length;
  618 |   await page.waitForTimeout(500);
  619 |   expect(mainFrameNavigations).toHaveLength(settledNavigations);
  620 | });
  621 | 
  622 | test('concurrent expired API requests share one refresh and preserve the current route', async ({ page }) => {
  623 |   test.setTimeout(120_000);
  624 |   const state = makeApiState();
  625 |   state.messages.push({
  626 |     role: 'assistant',
  627 |     content: 'Restored conversation',
  628 |     createdAt: new Date().toISOString(),
  629 |   });
  630 |   const refreshRequests: number[] = [];
  631 |   const unauthorizedPaths = new Map([
  632 |     ['/subscription/status', 1],
  633 |     [`/ai/agent/conversations/${conversationId}`, 1],
  634 |   ]);
  635 |   await page.addInitScript((id) => {
  636 |     sessionStorage.setItem('workgrind_access_token', 'playwright-expired-access');
  637 |     sessionStorage.setItem('workgrind:ai:active-conversation:playwright-user', id);
  638 |   }, conversationId);
  639 |   await page.routeWebSocket('**/socket.io/**', (socket) => {
  640 |     socket.close({ code: 1000, reason: 'Socket.IO is not under test.' });
  641 |   });
  642 |   await page.route('**/api/**', (route) => mockApi(route, {
  643 |     ...state,
  644 |     failSubscriptionRequestAt: undefined,
  645 |     failFirstAgentRequest: false,
  646 |     refreshDelayMs: 150,
  647 |     refreshRequests,
  648 |     unauthorizedPaths,
  649 |   }));
  650 |   await page.goto('/ai');
  651 | 
  652 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  653 |   await expect(page.getByText('Restored conversation')).toBeVisible();
  654 |   expect(refreshRequests).toHaveLength(1);
  655 |   await expect(page).toHaveURL(/\/ai$/);
  656 | });
  657 | 
  658 | test('login 401 is not retried with a stale access token', async ({ page }) => {
  659 |   const refreshRequests: number[] = [];
  660 |   let loginRequests = 0;
  661 |   await page.route('**/api/**', async (route) => {
  662 |     const pathname = new URL(route.request().url()).pathname;
  663 |     if (pathname.endsWith('/auth/login')) {
  664 |       loginRequests += 1;
  665 |       await route.fulfill({
  666 |         status: 401,
  667 |         contentType: 'application/json',
  668 |         body: JSON.stringify({ success: false, message: 'Invalid credentials.' }),
  669 |       });
  670 |       return;
  671 |     }
  672 |     await mockApi(route, {
  673 |       ...makeApiState(),
  674 |       failSubscriptionRequestAt: undefined,
  675 |       failFirstAgentRequest: false,
  676 |       refreshStatus: 401,
  677 |       refreshRequests,
  678 |     });
  679 |   });
  680 |   await page.goto('/login');
  681 |   await page.getByLabel('Email address').fill('invalid@example.invalid');
  682 |   await expect.poll(() => refreshRequests.length).toBe(1);
  683 |   await page.evaluate(() => {
  684 |     sessionStorage.setItem('workgrind_access_token', 'playwright-stale-access');
  685 |   });
  686 |   await page.locator('#login-password').fill('not-a-real-secret');
  687 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  688 | 
```