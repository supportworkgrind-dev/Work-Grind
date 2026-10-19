# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> a protected request without an access token recovers through the refresh cookie
- Location: tests\billing-ai-regressions.spec.ts:388:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 1
Received length: 0
Received array:  []
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
        - generic [ref=e203]:
          - generic [ref=e204]:
            - paragraph [ref=e205]: Billing
            - heading "Workspace Subscription" [level=1] [ref=e206]
            - paragraph [ref=e207]: Subscription and plan limits apply to this workspace.
          - generic [ref=e208]:
            - generic [ref=e209]:
              - generic [ref=e214]:
                - heading "Workspace Plan" [level=2] [ref=e215]
                - paragraph [ref=e216]: Regression Workspace · shared by all members
              - button "Refresh" [ref=e217] [cursor=pointer]
            - generic [ref=e223]:
              - generic [ref=e224]:
                - paragraph [ref=e225]: Plan
                - paragraph [ref=e226]: Pro
              - generic [ref=e227]:
                - paragraph [ref=e228]: Status
                - generic [ref=e229]: Active
              - generic [ref=e230]:
                - paragraph [ref=e231]: Price
                - paragraph [ref=e232]: $29/month
              - generic [ref=e233]:
                - paragraph [ref=e234]: Next billing
                - paragraph [ref=e235]: —
          - generic [ref=e236]:
            - heading "Change Plan" [level=2] [ref=e237]
            - generic [ref=e238]:
              - generic [ref=e239]:
                - generic [ref=e240]:
                  - paragraph [ref=e241]: Free
                  - generic [ref=e242]: Free
                  - paragraph [ref=e244]: Regression test plan
                - list [ref=e245]:
                  - listitem [ref=e246]: Workspace tools
                - paragraph [ref=e250]: Available as a 7-day trial
              - generic [ref=e251]:
                - generic [ref=e252]:
                  - paragraph [ref=e253]: Starter
                  - generic [ref=e254]:
                    - generic [ref=e255]: $29
                    - generic [ref=e256]: /mo
                  - paragraph [ref=e257]: Regression test plan
                - list [ref=e258]:
                  - listitem [ref=e259]: Workspace tools
                - button "Downgrade to Starter" [ref=e263] [cursor=pointer]
              - generic [ref=e264]:
                - generic [ref=e265]:
                  - paragraph [ref=e266]: Pro
                  - generic [ref=e267]:
                    - generic [ref=e268]: $58
                    - generic [ref=e269]: /mo
                  - paragraph [ref=e270]: Regression test plan
                - list [ref=e271]:
                  - listitem [ref=e272]: Workspace tools
                - generic [ref=e276]: Current plan
            - paragraph [ref=e280]: Payments processed securely by Polar. No card stored on our servers. Your workspace pays once — all members are covered.
          - generic [ref=e281]:
            - heading "Redeem a Coupon" [level=3] [ref=e282]
            - paragraph [ref=e286]: Apply a coupon code to your workspace to unlock discounts or special offers.
            - generic [ref=e287]:
              - textbox "Enter coupon code" [ref=e288]
              - button "Apply" [disabled]
          - generic [ref=e289]:
            - heading "Cancel Workspace Subscription" [level=3] [ref=e290]
            - paragraph [ref=e291]: All workspace members will keep access until the end of the current billing period.
            - button "Cancel subscription" [ref=e292] [cursor=pointer]
```

# Test source

```ts
  323 |   const state = makeApiState();
  324 |   await setSessionAuth(page);
  325 |   await page.route('**/api/**', (route) => mockApi(route, {
  326 |     ...state,
  327 |     failSubscriptionRequestAt: undefined,
  328 |     failFirstAgentRequest: false,
  329 |   }));
  330 |   await page.goto('/ai');
  331 |   const composer = page.getByPlaceholder(/Ask me to find tasks/);
  332 |   await expect(composer).toBeVisible();
  333 |   await composer.fill('Reply with the word OK.');
  334 |   const navigationCount = { value: 0 };
  335 |   page.on('framenavigated', (frame) => {
  336 |     if (frame === page.mainFrame()) navigationCount.value += 1;
  337 |   });
  338 |   const mainFrameNavigations = navigationCount.value;
  339 |   await page.getByRole('button', { name: 'Send' }).click();
  340 |   await expect(page.getByText('OK response').first()).toBeVisible();
  341 |   await expect.poll(() => state.agentRequests.length).toBe(1);
  342 |   expect(state.agentRequests[0].conversationId).toBeUndefined();
  343 |   expect(navigationCount.value).toBe(mainFrameNavigations);
  344 |   await expect(page).toHaveURL(/\/ai$/);
  345 | 
  346 |   await page.reload();
  347 |   const restoredComposer = page.getByPlaceholder(/Ask me to find tasks/);
  348 |   await expect(restoredComposer).toBeVisible();
  349 |   await expect(page.getByText('Reply with the word OK.')).toBeVisible();
  350 |   await expect(page.getByText('OK response').first()).toBeVisible();
  351 | 
  352 |   await restoredComposer.fill('Continue in this same conversation.');
  353 |   await page.getByRole('button', { name: 'Send' }).click();
  354 |   await expect.poll(() => state.agentRequests.length).toBe(2);
  355 |   expect(state.agentRequests[1].conversationId).toBe(conversationId);
  356 |   await expect(page.getByText('Continue in this same conversation.')).toBeVisible();
  357 |   await expect(page.getByText('OK response').last()).toBeVisible();
  358 |   await expect(page).toHaveURL(/\/ai$/);
  359 | });
  360 | 
  361 | test('Tavro remains on the same route when /auth/me recovers through refresh', async ({ page }) => {
  362 |   const state = makeApiState();
  363 |   const currentUser401 = { value: false };
  364 |   const refreshRequests: number[] = [];
  365 |   const currentUserTokens: string[] = [];
  366 |   await setSessionAuth(page);
  367 |   await page.route('**/api/**', async (route) => {
  368 |     await mockApi(route, {
  369 |       ...state,
  370 |       failSubscriptionRequestAt: undefined,
  371 |       failFirstAgentRequest: false,
  372 |       expireCurrentUserOnce: currentUser401,
  373 |       currentUserTokens,
  374 |       refreshRequests,
  375 |     });
  376 |   });
  377 |   await page.goto('/ai');
  378 | 
  379 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  380 |   await expect(page).toHaveURL(/\/ai$/);
  381 |   expect(refreshRequests).toHaveLength(1);
  382 |   expect(currentUser401.value).toBe(true);
  383 |   expect(currentUserTokens[0]).toBe('Bearer playwright-regression-access');
  384 |   expect(currentUserTokens.slice(1).length).toBeGreaterThan(0);
  385 |   expect(currentUserTokens.slice(1).every((token) => token === 'Bearer playwright-refreshed-access')).toBe(true);
  386 | });
  387 | 
  388 | test('a protected request without an access token recovers through the refresh cookie', async ({ page }) => {
  389 |   const state = makeApiState();
  390 |   const refreshRequests: number[] = [];
  391 |   const missingTokenRequests: string[] = [];
  392 |   await setSessionAuth(page);
  393 |   await page.route('**/api/**', async (route) => {
  394 |     const request = route.request();
  395 |     const pathname = new URL(request.url()).pathname;
  396 |     if (pathname.endsWith('/subscription/status')) {
  397 |       const authorization = request.headers().authorization ?? '';
  398 |       if (!authorization) {
  399 |         missingTokenRequests.push(authorization);
  400 |         await route.fulfill({
  401 |           status: 401,
  402 |           contentType: 'application/json',
  403 |           body: JSON.stringify({ success: false, message: 'No token provided' }),
  404 |         });
  405 |         return;
  406 |       }
  407 |     }
  408 |     await mockApi(route, {
  409 |       ...state,
  410 |       failSubscriptionRequestAt: undefined,
  411 |       failFirstAgentRequest: false,
  412 |       refreshRequests,
  413 |     });
  414 |   });
  415 |   await page.goto('/billing');
  416 |   await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
  417 |   await page.evaluate(() => sessionStorage.removeItem('workgrind_access_token'));
  418 | 
  419 |   await page.getByRole('button', { name: 'Refresh' }).click();
  420 | 
  421 |   await expect.poll(() => state.subscriptionRequests.length).toBeGreaterThan(1);
  422 |   expect(missingTokenRequests).toEqual(['']);
> 423 |   expect(refreshRequests).toHaveLength(1);
      |                           ^ Error: expect(received).toHaveLength(expected)
  424 | });
  425 | 
  426 | test('an expired or revoked refresh credential leaves a logged-out visitor on the public landing page', async ({ page }) => {
  427 |   const refreshRequests: number[] = [];
  428 |   const mainFrameNavigations: number[] = [];
  429 |   page.on('framenavigated', (frame) => {
  430 |     if (frame === page.mainFrame()) mainFrameNavigations.push(Date.now());
  431 |   });
  432 |   await page.route('**/api/**', (route) => mockApi(route, {
  433 |     ...makeApiState(),
  434 |     failSubscriptionRequestAt: undefined,
  435 |     failFirstAgentRequest: false,
  436 |     refreshStatus: 401,
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
```