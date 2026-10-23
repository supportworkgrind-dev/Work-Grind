# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> login 401 is not retried with a stale access token
- Location: tests\billing-ai-regressions.spec.ts:663:5

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
  587 |     });
  588 |   });
  589 |   await page.goto('/create-company');
  590 |   await page.getByPlaceholder('Apex Technologies').fill('North School');
  591 |   await page.getByRole('button', { name: 'Launch Workspace' }).click();
  592 | 
  593 |   await expect.poll(() => createCompanyAuthorization).toBe('Bearer playwright-regression-access');
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
> 687 |   await expect.poll(() => refreshRequests.length).toBe(1);
      |                                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  688 |   await page.evaluate(() => {
  689 |     sessionStorage.setItem('workgrind_access_token', 'playwright-stale-access');
  690 |   });
  691 |   await page.locator('#login-password').fill('not-a-real-secret');
  692 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  693 | 
  694 |   await expect(page.locator('.auth-error[role="alert"]')).toContainText('Invalid credentials.');
  695 |   expect(loginRequests).toBe(1);
  696 |   expect(refreshRequests).toHaveLength(1);
  697 |   await expect(page).toHaveURL(/\/login$/);
  698 | });
  699 | 
  700 | test('logout does not refresh a session after its logout request is rejected', async ({ page }) => {
  701 |   await setSessionAuth(page);
  702 |   const refreshRequests: number[] = [];
  703 |   let logoutRequests = 0;
  704 |   await page.route('**/api/**', async (route) => {
  705 |     const pathname = new URL(route.request().url()).pathname;
  706 |     if (pathname.endsWith('/auth/logout')) {
  707 |       logoutRequests += 1;
  708 |       await route.fulfill({
  709 |         status: 401,
  710 |         contentType: 'application/json',
  711 |         body: JSON.stringify({ success: false, message: 'Session already expired.' }),
  712 |       });
  713 |       return;
  714 |     }
  715 |     await mockApi(route, {
  716 |       ...makeApiState(),
  717 |       failSubscriptionRequestAt: undefined,
  718 |       failFirstAgentRequest: false,
  719 |       refreshRequests,
  720 |     });
  721 |   });
  722 |   await page.goto('/ai');
  723 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  724 |   await page.locator('aside button[aria-haspopup="menu"]').click();
  725 |   await page.getByRole('menuitem', { name: 'Sign out' }).click();
  726 | 
  727 |   await expect(page).toHaveURL(/\/login\?redirect=/);
  728 |   expect(logoutRequests).toBe(1);
  729 |   expect(refreshRequests).toHaveLength(0);
  730 | });
  731 | 
  732 | test('the initial service-worker takeover does not trigger a full-page reload', () => {
  733 |   expect(shouldReloadForServiceWorkerControllerChange(false, false)).toBe(false);
  734 |   expect(shouldReloadForServiceWorkerControllerChange(true, true)).toBe(false);
  735 |   expect(shouldReloadForServiceWorkerControllerChange(true, false)).toBe(true);
  736 | });
  737 | 
  738 | test('refresh requests from two tabs are serialized while refresh-token cookies rotate', async ({ browser }) => {
  739 |   const context = await browser.newContext();
  740 |   const firstPage = await context.newPage();
  741 |   const secondPage = await context.newPage();
  742 |   const activeRefreshRequests = { count: 0, maximum: 0 };
  743 |   const refreshCount = { count: 0 };
  744 |   const createPageHandler = (page401: { value: boolean }) => async (route: Route) => {
  745 |     const pathname = new URL(route.request().url()).pathname;
  746 |     if (pathname.endsWith('/auth/refresh')) {
  747 |       refreshCount.count += 1;
  748 |       activeRefreshRequests.count += 1;
  749 |       activeRefreshRequests.maximum = Math.max(activeRefreshRequests.maximum, activeRefreshRequests.count);
  750 |       await new Promise((resolve) => setTimeout(resolve, 100));
  751 |       const responseNumber = refreshCount.count;
  752 |       await route.fulfill({
  753 |         status: 200,
  754 |         headers: {
  755 |           'set-cookie': `wg_refresh=rotated-${responseNumber}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax`,
  756 |         },
  757 |         contentType: 'application/json',
  758 |         body: JSON.stringify({ success: true, accessToken: `playwright-rotated-access-${responseNumber}` }),
  759 |       });
  760 |       activeRefreshRequests.count -= 1;
  761 |       return;
  762 |     }
  763 |     await mockApi(route, {
  764 |       ...makeApiState(),
  765 |       failSubscriptionRequestAt: undefined,
  766 |       failFirstAgentRequest: false,
  767 |       expireCurrentUserOnce: page401,
  768 |     });
  769 |   };
  770 | 
  771 |   await Promise.all([firstPage, secondPage].map((page) => page.addInitScript(() => {
  772 |     sessionStorage.setItem('workgrind_access_token', 'playwright-regression-access');
  773 |   })));
  774 |   await firstPage.route('**/api/**', createPageHandler({ value: false }));
  775 |   await secondPage.route('**/api/**', createPageHandler({ value: false }));
  776 |   await Promise.all([firstPage.goto('/ai'), secondPage.goto('/ai')]);
  777 |   await Promise.all([
  778 |     expect(firstPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  779 |     expect(secondPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  780 |   ]);
  781 | 
  782 |   expect(refreshCount.count).toBe(2);
  783 |   expect(activeRefreshRequests.maximum).toBe(1);
  784 |   await context.close();
  785 | });
  786 | 
  787 | test('production CSP connection sources include only the configured API and LiveKit origins plus ICE schemes', () => {
```