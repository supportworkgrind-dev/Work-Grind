# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> logout does not refresh a session after its logout request is rejected
- Location: tests\billing-ai-regressions.spec.ts:513:5

# Error details

```
Error: locator.click: Error: strict mode violation: locator('button[aria-haspopup="menu"]') resolved to 3 elements:
    1) <button aria-haspopup="menu" aria-expanded="false" class="↵              flex w-full items-center gap-3 rounded-xl p-2↵              transition-all duration-150 hover:theme-bg-hover↵              ↵            ">…</button> aka getByRole('button', { name: 'RU Regression User owner' })
    2) <button aria-haspopup="menu" aria-expanded="false" class="btn-primary h-9 px-3 sm:px-3.5 gap-1.5">…</button> aka getByRole('button', { name: 'New' })
    3) <button id="next-logo" aria-haspopup="menu" data-next-mark="true" aria-expanded="false" aria-label="Open Next.js Dev Tools" data-nextjs-dev-tools-button="true" aria-controls="nextjs-dev-tools-menu">…</button> aka getByRole('button', { name: 'Open Next.js Dev Tools' })

Call log:
  - waiting for locator('button[aria-haspopup="menu"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - generic [ref=e12]:
    - complementary [ref=e13]:
      - generic [ref=e14]:
        - img "WorkGrind" [ref=e16]
        - generic [ref=e20]:
          - generic [ref=e21]: Regression Workspace
          - generic [ref=e22]: owner
      - navigation [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]: WORKSPACE
            - generic [ref=e29]:
              - link "Overview" [ref=e30] [cursor=pointer]:
                - /url: /dashboard
              - link "Tasks" [ref=e37] [cursor=pointer]:
                - /url: /tasks
              - link "Projects" [ref=e42] [cursor=pointer]:
                - /url: /projects
              - link "Calendar" [ref=e46] [cursor=pointer]:
                - /url: /calendar
          - generic [ref=e50]:
            - generic [ref=e51]: CUSTOMERS
            - generic [ref=e52]:
              - link "CRM" [ref=e53] [cursor=pointer]:
                - /url: /crm
              - link "Client Portal" [ref=e60] [cursor=pointer]:
                - /url: /client-portal-mgmt
          - generic [ref=e65]:
            - generic [ref=e66]: COLLABORATE
            - generic [ref=e67]:
              - link "Chat" [ref=e68] [cursor=pointer]:
                - /url: /chat
              - link "Meetings" [ref=e72] [cursor=pointer]:
                - /url: /meetings
              - link "Global Calling" [ref=e76] [cursor=pointer]:
                - /url: /calling
              - link "Whiteboard" [ref=e82] [cursor=pointer]:
                - /url: /whiteboard
              - link "Docs" [ref=e87] [cursor=pointer]:
                - /url: /docs
          - generic [ref=e92]:
            - generic [ref=e93]: RESOURCES
            - generic [ref=e94]:
              - link "Files" [ref=e95] [cursor=pointer]:
                - /url: /files
              - link "Sheets" [ref=e99] [cursor=pointer]:
                - /url: /sheets
              - link "Analytics" [ref=e103] [cursor=pointer]:
                - /url: /analytics
              - link "Automation" [ref=e107] [cursor=pointer]:
                - /url: /workflows
              - link "Social Publishing" [ref=e113] [cursor=pointer]:
                - /url: /social-publishing
          - generic [ref=e121]:
            - generic [ref=e122]: INTELLIGENCE
            - link "Tavro AI" [ref=e124] [cursor=pointer]:
              - /url: /ai
          - generic [ref=e129]:
            - generic [ref=e130]: ADMIN
            - generic [ref=e131]:
              - link "Team" [ref=e132] [cursor=pointer]:
                - /url: /team
              - link "Notifications" [ref=e138] [cursor=pointer]:
                - /url: /notifications
              - link "Billing" [ref=e143] [cursor=pointer]:
                - /url: /billing
              - link "Settings" [ref=e147] [cursor=pointer]:
                - /url: /settings
      - button "RU Regression User owner" [ref=e154] [cursor=pointer]:
        - generic [ref=e155]: RU
        - generic [ref=e159]:
          - generic [ref=e160]: Regression User
          - generic [ref=e161]: owner
    - generic [ref=e164]:
      - banner [ref=e165]:
        - generic [ref=e166]:
          - button "Toggle sidebar" [ref=e167] [cursor=pointer]
          - link "WorkGrind home" [ref=e169] [cursor=pointer]:
            - /url: /dashboard
            - img "WorkGrind" [ref=e171]:
              - generic [aria-hidden] [ref=e175]:
                - generic [ref=e176]: Work
                - generic [ref=e177]: Grind
          - button "Open search (Ctrl+K)" [ref=e178] [cursor=pointer]:
            - generic [ref=e182]: Search anything...
            - generic [ref=e183]: ⌘K
        - generic [ref=e184]:
          - generic [ref=e185]: Online
          - button "New" [ref=e190] [cursor=pointer]
          - button "Notifications" [ref=e196] [cursor=pointer]
          - link "Account settings" [ref=e200] [cursor=pointer]:
            - /url: /settings
            - generic [ref=e201]: RU
      - main [ref=e202]:
        - generic [ref=e204]:
          - generic [ref=e205]:
            - generic [ref=e211]:
              - heading "Tavro AI" [level=2] [ref=e212]
              - paragraph [ref=e213]: Workspace-aware · Action-capable
            - generic [ref=e214]:
              - generic [ref=e215]: Active
              - button "Voice" [ref=e216] [cursor=pointer]
              - button "History" [ref=e221] [cursor=pointer]
          - generic [ref=e232]:
            - generic [ref=e234]:
              - paragraph [ref=e235]: Hello Regression! 👋 I'm Tavro AI, WorkGrind's assistant for business and education workspaces.
              - paragraph [ref=e236]: Ask me about WorkGrind, or request help with information and actions available to your role and plan.
            - paragraph [ref=e238]: 05:00 AM
          - generic [ref=e239]:
            - paragraph [ref=e240]: Quick actions
            - generic [ref=e241]:
              - button "Overdue tasks" [ref=e242] [cursor=pointer]
              - button "Week summary" [ref=e246] [cursor=pointer]
              - button "Analyze CRM" [ref=e248] [cursor=pointer]
              - button "Today's priorities" [ref=e253] [cursor=pointer]
              - button "Team overview" [ref=e257] [cursor=pointer]
              - button "Find a client" [ref=e263] [cursor=pointer]
          - generic [ref=e267]:
            - generic [ref=e268]:
              - textbox "Ask me to find tasks, create meetings, analyze deals…" [ref=e269]
              - button "Send" [disabled] [ref=e270]
            - paragraph [ref=e274]: Press Enter to send · Shift+Enter for new line
```

# Test source

```ts
  437 |     refreshRequests,
  438 |   }));
  439 | 
  440 |   await page.goto('/');
  441 |   await expect(page).toHaveURL(/\/$/);
  442 |   await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
  443 |   await page.waitForTimeout(500);
  444 |   expect(refreshRequests).toHaveLength(1);
  445 |   expect(mainFrameNavigations).toHaveLength(1);
  446 | });
  447 | 
  448 | test('concurrent expired API requests share one refresh and preserve the current route', async ({ page }) => {
  449 |   const state = makeApiState();
  450 |   state.messages.push({
  451 |     role: 'assistant',
  452 |     content: 'Restored conversation',
  453 |     createdAt: new Date().toISOString(),
  454 |   });
  455 |   const refreshRequests: number[] = [];
  456 |   const unauthorizedPaths = new Map([
  457 |     ['/subscription/status', 1],
  458 |     [`/ai/agent/conversations/${conversationId}`, 1],
  459 |   ]);
  460 |   await page.addInitScript((id) => {
  461 |     sessionStorage.setItem('workgrind_access_token', 'playwright-expired-access');
  462 |     sessionStorage.setItem('workgrind:ai:active-conversation:playwright-user', id);
  463 |   }, conversationId);
  464 |   await page.route('**/api/**', (route) => mockApi(route, {
  465 |     ...state,
  466 |     failSubscriptionRequestAt: undefined,
  467 |     failFirstAgentRequest: false,
  468 |     refreshDelayMs: 150,
  469 |     refreshRequests,
  470 |     unauthorizedPaths,
  471 |   }));
  472 |   await page.goto('/ai');
  473 | 
  474 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  475 |   await expect(page.getByText('Restored conversation')).toBeVisible();
  476 |   expect(refreshRequests).toHaveLength(1);
  477 |   await expect(page).toHaveURL(/\/ai$/);
  478 | });
  479 | 
  480 | test('login 401 is not retried with a stale access token', async ({ page }) => {
  481 |   await setSessionAuth(page);
  482 |   const refreshRequests: number[] = [];
  483 |   let loginRequests = 0;
  484 |   await page.route('**/api/**', async (route) => {
  485 |     const pathname = new URL(route.request().url()).pathname;
  486 |     if (pathname.endsWith('/auth/login')) {
  487 |       loginRequests += 1;
  488 |       await route.fulfill({
  489 |         status: 401,
  490 |         contentType: 'application/json',
  491 |         body: JSON.stringify({ success: false, message: 'Invalid credentials.' }),
  492 |       });
  493 |       return;
  494 |     }
  495 |     await mockApi(route, {
  496 |       ...makeApiState(),
  497 |       failSubscriptionRequestAt: undefined,
  498 |       failFirstAgentRequest: false,
  499 |       refreshRequests,
  500 |     });
  501 |   });
  502 |   await page.goto('/login');
  503 |   await page.getByLabel('Work email').fill('invalid@example.invalid');
  504 |   await page.locator('#login-password').fill('not-a-real-secret');
  505 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  506 | 
  507 |   await expect(page.getByRole('alert')).toContainText('Invalid credentials.');
  508 |   expect(loginRequests).toBe(1);
  509 |   expect(refreshRequests).toHaveLength(0);
  510 |   await expect(page).toHaveURL(/\/login$/);
  511 | });
  512 | 
  513 | test('logout does not refresh a session after its logout request is rejected', async ({ page }) => {
  514 |   await setSessionAuth(page);
  515 |   const refreshRequests: number[] = [];
  516 |   let logoutRequests = 0;
  517 |   await page.route('**/api/**', async (route) => {
  518 |     const pathname = new URL(route.request().url()).pathname;
  519 |     if (pathname.endsWith('/auth/logout')) {
  520 |       logoutRequests += 1;
  521 |       await route.fulfill({
  522 |         status: 401,
  523 |         contentType: 'application/json',
  524 |         body: JSON.stringify({ success: false, message: 'Session already expired.' }),
  525 |       });
  526 |       return;
  527 |     }
  528 |     await mockApi(route, {
  529 |       ...makeApiState(),
  530 |       failSubscriptionRequestAt: undefined,
  531 |       failFirstAgentRequest: false,
  532 |       refreshRequests,
  533 |     });
  534 |   });
  535 |   await page.goto('/ai');
  536 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
> 537 |   await page.locator('button[aria-haspopup="menu"]').click();
      |                                                      ^ Error: locator.click: Error: strict mode violation: locator('button[aria-haspopup="menu"]') resolved to 3 elements:
  538 |   await page.getByRole('menuitem', { name: 'Sign out' }).click();
  539 | 
  540 |   await expect(page).toHaveURL(/\/login\?redirect=/);
  541 |   expect(logoutRequests).toBe(1);
  542 |   expect(refreshRequests).toHaveLength(0);
  543 | });
  544 | 
  545 | test('the initial service-worker takeover does not trigger a full-page reload', () => {
  546 |   expect(shouldReloadForServiceWorkerControllerChange(false, false)).toBe(false);
  547 |   expect(shouldReloadForServiceWorkerControllerChange(true, true)).toBe(false);
  548 |   expect(shouldReloadForServiceWorkerControllerChange(true, false)).toBe(true);
  549 | });
  550 | 
  551 | test('refresh requests from two tabs are serialized while refresh-token cookies rotate', async ({ browser }) => {
  552 |   const context = await browser.newContext();
  553 |   const firstPage = await context.newPage();
  554 |   const secondPage = await context.newPage();
  555 |   const activeRefreshRequests = { count: 0, maximum: 0 };
  556 |   const refreshCount = { count: 0 };
  557 |   const createPageHandler = (page401: { value: boolean }) => async (route: Route) => {
  558 |     const pathname = new URL(route.request().url()).pathname;
  559 |     if (pathname.endsWith('/auth/refresh')) {
  560 |       refreshCount.count += 1;
  561 |       activeRefreshRequests.count += 1;
  562 |       activeRefreshRequests.maximum = Math.max(activeRefreshRequests.maximum, activeRefreshRequests.count);
  563 |       await new Promise((resolve) => setTimeout(resolve, 100));
  564 |       const responseNumber = refreshCount.count;
  565 |       await route.fulfill({
  566 |         status: 200,
  567 |         headers: {
  568 |           'set-cookie': `wg_refresh=rotated-${responseNumber}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax`,
  569 |         },
  570 |         contentType: 'application/json',
  571 |         body: JSON.stringify({ success: true, accessToken: `playwright-rotated-access-${responseNumber}` }),
  572 |       });
  573 |       activeRefreshRequests.count -= 1;
  574 |       return;
  575 |     }
  576 |     await mockApi(route, {
  577 |       ...makeApiState(),
  578 |       failSubscriptionRequestAt: undefined,
  579 |       failFirstAgentRequest: false,
  580 |       expireCurrentUserOnce: page401,
  581 |     });
  582 |   };
  583 | 
  584 |   await Promise.all([firstPage, secondPage].map((page) => page.addInitScript(() => {
  585 |     sessionStorage.setItem('workgrind_access_token', 'playwright-regression-access');
  586 |   })));
  587 |   await firstPage.route('**/api/**', createPageHandler({ value: false }));
  588 |   await secondPage.route('**/api/**', createPageHandler({ value: false }));
  589 |   await Promise.all([firstPage.goto('/ai'), secondPage.goto('/ai')]);
  590 |   await Promise.all([
  591 |     expect(firstPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  592 |     expect(secondPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  593 |   ]);
  594 | 
  595 |   expect(refreshCount.count).toBe(2);
  596 |   expect(activeRefreshRequests.maximum).toBe(1);
  597 |   await context.close();
  598 | });
  599 | 
  600 | test('production CSP connection sources include only the configured API and LiveKit origins plus ICE schemes', () => {
  601 |   expect(getTrustedConnectionSources(
  602 |     'https://backend-workgrind.vercel.app/api',
  603 |     'wss://work-grind-bjshvbs1.livekit.cloud',
  604 |   )).toEqual([
  605 |     'https://backend-workgrind.vercel.app',
  606 |     'wss://backend-workgrind.vercel.app',
  607 |     'wss://work-grind-bjshvbs1.livekit.cloud',
  608 |     'https://work-grind-bjshvbs1.livekit.cloud',
  609 |     'stun:',
  610 |     'turn:',
  611 |     'turns:',
  612 |   ]);
  613 | });
  614 | 
  615 | test('Socket.IO targets the configured backend and uses the Vercel function socket path', () => {
  616 |   expect(resolveSocketUrl(
  617 |     undefined,
  618 |     'https://backend-workgrind.vercel.app/api',
  619 |     'https://workgrind.vercel.app',
  620 |     false,
  621 |   )).toBe('https://backend-workgrind.vercel.app');
  622 |   expect(SOCKET_IO_PATH).toBe('/api/socket-io/socket.io');
  623 | });
  624 | 
  625 | test('Tavro shows retry controls when the agent API returns a server error', async ({ page }) => {
  626 |   const state = makeApiState();
  627 |   await setSessionAuth(page);
  628 |   await page.route('**/api/**', (route) => mockApi(route, {
  629 |     ...state,
  630 |     failSubscriptionRequestAt: undefined,
  631 |     failFirstAgentRequest: true,
  632 |   }));
  633 |   await page.goto('/ai');
  634 |   const composer = page.getByPlaceholder(/Ask me to find tasks/);
  635 |   await expect(composer).toBeVisible();
  636 |   await composer.fill('A harmless retry test.');
  637 |   await page.getByRole('button', { name: 'Send' }).click();
```