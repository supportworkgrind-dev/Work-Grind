# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> login 401 is not retried with a stale access token
- Location: tests\billing-ai-regressions.spec.ts:658:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 0

Call Log:
- Timeout 15000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
            - textbox "Email address" [active] [ref=e73]:
              - /placeholder: you@example.com
              - text: invalid@example.invalid
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
  582 |     });
  583 |   });
  584 |   await page.goto('/create-company');
  585 |   await page.getByPlaceholder('Apex Technologies').fill('North School');
  586 |   await page.getByRole('button', { name: 'Launch Workspace' }).click();
  587 | 
  588 |   await expect.poll(() => createCompanyAuthorization).toBe('Bearer playwright-regression-access');
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
> 682 |   await expect.poll(() => refreshRequests.length).toBe(1);
      |                                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  683 |   await page.evaluate(() => {
  684 |     sessionStorage.setItem('workgrind_access_token', 'playwright-stale-access');
  685 |   });
  686 |   await page.locator('#login-password').fill('not-a-real-secret');
  687 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  688 | 
  689 |   await expect(page.locator('.auth-error[role="alert"]')).toContainText('Invalid credentials.');
  690 |   expect(loginRequests).toBe(1);
  691 |   expect(refreshRequests).toHaveLength(1);
  692 |   await expect(page).toHaveURL(/\/login$/);
  693 | });
  694 | 
  695 | test('logout does not refresh a session after its logout request is rejected', async ({ page }) => {
  696 |   await setSessionAuth(page);
  697 |   const refreshRequests: number[] = [];
  698 |   let logoutRequests = 0;
  699 |   await page.route('**/api/**', async (route) => {
  700 |     const pathname = new URL(route.request().url()).pathname;
  701 |     if (pathname.endsWith('/auth/logout')) {
  702 |       logoutRequests += 1;
  703 |       await route.fulfill({
  704 |         status: 401,
  705 |         contentType: 'application/json',
  706 |         body: JSON.stringify({ success: false, message: 'Session already expired.' }),
  707 |       });
  708 |       return;
  709 |     }
  710 |     await mockApi(route, {
  711 |       ...makeApiState(),
  712 |       failSubscriptionRequestAt: undefined,
  713 |       failFirstAgentRequest: false,
  714 |       refreshRequests,
  715 |     });
  716 |   });
  717 |   await page.goto('/ai');
  718 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  719 |   await page.locator('aside button[aria-haspopup="menu"]').click();
  720 |   await page.getByRole('menuitem', { name: 'Sign out' }).click();
  721 | 
  722 |   await expect(page).toHaveURL(/\/login\?redirect=/);
  723 |   expect(logoutRequests).toBe(1);
  724 |   expect(refreshRequests).toHaveLength(0);
  725 | });
  726 | 
  727 | test('the initial service-worker takeover does not trigger a full-page reload', () => {
  728 |   expect(shouldReloadForServiceWorkerControllerChange(false, false)).toBe(false);
  729 |   expect(shouldReloadForServiceWorkerControllerChange(true, true)).toBe(false);
  730 |   expect(shouldReloadForServiceWorkerControllerChange(true, false)).toBe(true);
  731 | });
  732 | 
  733 | test('refresh requests from two tabs are serialized while refresh-token cookies rotate', async ({ browser }) => {
  734 |   const context = await browser.newContext();
  735 |   const firstPage = await context.newPage();
  736 |   const secondPage = await context.newPage();
  737 |   const activeRefreshRequests = { count: 0, maximum: 0 };
  738 |   const refreshCount = { count: 0 };
  739 |   const createPageHandler = (page401: { value: boolean }) => async (route: Route) => {
  740 |     const pathname = new URL(route.request().url()).pathname;
  741 |     if (pathname.endsWith('/auth/refresh')) {
  742 |       refreshCount.count += 1;
  743 |       activeRefreshRequests.count += 1;
  744 |       activeRefreshRequests.maximum = Math.max(activeRefreshRequests.maximum, activeRefreshRequests.count);
  745 |       await new Promise((resolve) => setTimeout(resolve, 100));
  746 |       const responseNumber = refreshCount.count;
  747 |       await route.fulfill({
  748 |         status: 200,
  749 |         headers: {
  750 |           'set-cookie': `wg_refresh=rotated-${responseNumber}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax`,
  751 |         },
  752 |         contentType: 'application/json',
  753 |         body: JSON.stringify({ success: true, accessToken: `playwright-rotated-access-${responseNumber}` }),
  754 |       });
  755 |       activeRefreshRequests.count -= 1;
  756 |       return;
  757 |     }
  758 |     await mockApi(route, {
  759 |       ...makeApiState(),
  760 |       failSubscriptionRequestAt: undefined,
  761 |       failFirstAgentRequest: false,
  762 |       expireCurrentUserOnce: page401,
  763 |     });
  764 |   };
  765 | 
  766 |   await Promise.all([firstPage, secondPage].map((page) => page.addInitScript(() => {
  767 |     sessionStorage.setItem('workgrind_access_token', 'playwright-regression-access');
  768 |   })));
  769 |   await firstPage.route('**/api/**', createPageHandler({ value: false }));
  770 |   await secondPage.route('**/api/**', createPageHandler({ value: false }));
  771 |   await Promise.all([firstPage.goto('/ai'), secondPage.goto('/ai')]);
  772 |   await Promise.all([
  773 |     expect(firstPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  774 |     expect(secondPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  775 |   ]);
  776 | 
  777 |   expect(refreshCount.count).toBe(2);
  778 |   expect(activeRefreshRequests.maximum).toBe(1);
  779 |   await context.close();
  780 | });
  781 | 
  782 | test('production CSP connection sources include only the configured API and LiveKit origins plus ICE schemes', () => {
```