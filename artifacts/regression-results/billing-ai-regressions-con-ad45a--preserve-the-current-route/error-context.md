# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> concurrent expired API requests share one refresh and preserve the current route
- Location: tests\billing-ai-regressions.spec.ts:627:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder(/Ask me to find tasks/)
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByPlaceholder(/Ask me to find tasks/) with timeout 15000ms
  - waiting for getByPlaceholder(/Ask me to find tasks/)

```

```yaml
- img "WorkGrind"
- alert
```

# Test source

```ts
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
> 657 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
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
```