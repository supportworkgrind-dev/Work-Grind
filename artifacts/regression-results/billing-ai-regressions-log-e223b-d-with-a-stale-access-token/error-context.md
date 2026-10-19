# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> login 401 is not retried with a stale access token
- Location: tests\billing-ai-regressions.spec.ts:480:5

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
  423 |   expect(refreshRequests).toHaveLength(1);
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
> 503 |   await page.getByLabel('Work email').fill('invalid@example.invalid');
      |                                       ^ Error: locator.fill: Test timeout of 60000ms exceeded.
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
  537 |   await page.locator('button[aria-haspopup="menu"]').click();
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
```