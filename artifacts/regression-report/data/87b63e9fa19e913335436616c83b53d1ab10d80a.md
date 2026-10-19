# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> a protected request without an access token recovers through the refresh cookie
- Location: tests\billing-ai-regressions.spec.ts:383:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Workspace Subscription', exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Workspace Subscription', exact: true }) with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Workspace Subscription', exact: true })

```

```yaml
- alert: WorkGrind Account
- img "WorkGrind"
- text: Step 1 of 2 Select Account Experience
- heading "How do you plan to use WorkGrind?" [level=2]
- paragraph: Choose an individual or organization workspace. Organizations can set up a business, school, college, or university workspace.
- text: Business & Education
- heading "Company / Institution" [level=3]
- paragraph: Set up an office or business team, school, college, or university. Available tools depend on workspace type, role, and plan.
- list:
  - listitem: Chat, meetings, and shared communication
  - listitem: Tasks, projects, and team coordination
  - listitem: CRM, client portal, documents, and files where available
- text: Solo & Freelance
- heading "Solo / Individual" [level=3]
- paragraph: Organize personal or freelance work with planning, tasks, projects, and documents. Tavro AI assistance is available where supported.
- list:
  - listitem: Personal tasks, projects, and priorities
  - listitem: Calendar and deadline planning
  - listitem: Tools and access suited to individual work
- button "Continue" [disabled]
```

# Test source

```ts
  311 |   await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
  312 |   await expect(page.getByRole('status')).toContainText('No subscription record is associated');
  313 |   await expect(page.getByText('No subscription', { exact: true })).toBeVisible();
  314 |   await expect(page.getByText('Available as a 7-day trial')).toBeVisible();
  315 | });
  316 | 
  317 | test('Tavro keeps the same conversation through the subscription refresh and restores it after reload', async ({ page }) => {
  318 |   const state = makeApiState();
  319 |   await setSessionAuth(page);
  320 |   await page.route('**/api/**', (route) => mockApi(route, {
  321 |     ...state,
  322 |     failSubscriptionRequestAt: undefined,
  323 |     failFirstAgentRequest: false,
  324 |   }));
  325 |   await page.goto('/ai');
  326 |   const composer = page.getByPlaceholder(/Ask me to find tasks/);
  327 |   await expect(composer).toBeVisible();
  328 |   await composer.fill('Reply with the word OK.');
  329 |   const navigationCount = { value: 0 };
  330 |   page.on('framenavigated', (frame) => {
  331 |     if (frame === page.mainFrame()) navigationCount.value += 1;
  332 |   });
  333 |   const mainFrameNavigations = navigationCount.value;
  334 |   await page.getByRole('button', { name: 'Send' }).click();
  335 |   await expect(page.getByText('OK response').first()).toBeVisible();
  336 |   await expect.poll(() => state.agentRequests.length).toBe(1);
  337 |   expect(state.agentRequests[0].conversationId).toBeUndefined();
  338 |   expect(navigationCount.value).toBe(mainFrameNavigations);
  339 |   await expect(page).toHaveURL(/\/ai$/);
  340 | 
  341 |   await page.reload();
  342 |   const restoredComposer = page.getByPlaceholder(/Ask me to find tasks/);
  343 |   await expect(restoredComposer).toBeVisible();
  344 |   await expect(page.getByText('Reply with the word OK.')).toBeVisible();
  345 |   await expect(page.getByText('OK response').first()).toBeVisible();
  346 | 
  347 |   await restoredComposer.fill('Continue in this same conversation.');
  348 |   await page.getByRole('button', { name: 'Send' }).click();
  349 |   await expect.poll(() => state.agentRequests.length).toBe(2);
  350 |   expect(state.agentRequests[1].conversationId).toBe(conversationId);
  351 |   await expect(page.getByText('Continue in this same conversation.')).toBeVisible();
  352 |   await expect(page.getByText('OK response').last()).toBeVisible();
  353 |   await expect(page).toHaveURL(/\/ai$/);
  354 | });
  355 | 
  356 | test('Tavro remains on the same route when /auth/me recovers through refresh', async ({ page }) => {
  357 |   const state = makeApiState();
  358 |   const currentUser401 = { value: false };
  359 |   const refreshRequests: number[] = [];
  360 |   const currentUserTokens: string[] = [];
  361 |   await setSessionAuth(page);
  362 |   await page.route('**/api/**', async (route) => {
  363 |     await mockApi(route, {
  364 |       ...state,
  365 |       failSubscriptionRequestAt: undefined,
  366 |       failFirstAgentRequest: false,
  367 |       expireCurrentUserOnce: currentUser401,
  368 |       currentUserTokens,
  369 |       refreshRequests,
  370 |     });
  371 |   });
  372 |   await page.goto('/ai');
  373 | 
  374 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  375 |   await expect(page).toHaveURL(/\/ai$/);
  376 |   expect(refreshRequests).toHaveLength(1);
  377 |   expect(currentUser401.value).toBe(true);
  378 |   expect(currentUserTokens[0]).toBe('Bearer playwright-regression-access');
  379 |   expect(currentUserTokens.slice(1).length).toBeGreaterThan(0);
  380 |   expect(currentUserTokens.slice(1).every((token) => token === 'Bearer playwright-refreshed-access')).toBe(true);
  381 | });
  382 | 
  383 | test('a protected request without an access token recovers through the refresh cookie', async ({ page }) => {
  384 |   const state = makeApiState();
  385 |   const refreshRequests: number[] = [];
  386 |   const missingTokenRequests: string[] = [];
  387 |   await setSessionAuth(page);
  388 |   await page.route('**/api/**', async (route) => {
  389 |     const request = route.request();
  390 |     const pathname = new URL(request.url()).pathname;
  391 |     if (pathname.endsWith('/subscription/status')) {
  392 |       const authorization = request.headers().authorization ?? '';
  393 |       if (!authorization) {
  394 |         missingTokenRequests.push(authorization);
  395 |         await route.fulfill({
  396 |           status: 401,
  397 |           contentType: 'application/json',
  398 |           body: JSON.stringify({ success: false, message: 'No token provided' }),
  399 |         });
  400 |         return;
  401 |       }
  402 |     }
  403 |     await mockApi(route, {
  404 |       ...state,
  405 |       failSubscriptionRequestAt: undefined,
  406 |       failFirstAgentRequest: false,
  407 |       refreshRequests,
  408 |     });
  409 |   });
  410 |   await page.goto('/billing');
> 411 |   await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
      |                                                                                            ^ Error: expect(locator).toBeVisible() failed
  412 |   await page.evaluate(() => sessionStorage.removeItem('workgrind_access_token'));
  413 | 
  414 |   await page.getByRole('button', { name: 'Refresh' }).click();
  415 | 
  416 |   await expect.poll(() => state.subscriptionRequests.length).toBeGreaterThan(1);
  417 |   expect(missingTokenRequests).toEqual(['']);
  418 |   expect(refreshRequests).toHaveLength(1);
  419 | });
  420 | 
  421 | test('an expired or revoked refresh credential leaves a logged-out visitor on the public landing page', async ({ page }) => {
  422 |   const refreshRequests: number[] = [];
  423 |   const mainFrameNavigations: number[] = [];
  424 |   page.on('framenavigated', (frame) => {
  425 |     if (frame === page.mainFrame()) mainFrameNavigations.push(Date.now());
  426 |   });
  427 |   await page.route('**/api/**', (route) => mockApi(route, {
  428 |     ...makeApiState(),
  429 |     failSubscriptionRequestAt: undefined,
  430 |     failFirstAgentRequest: false,
  431 |     refreshStatus: 401,
  432 |     refreshRequests,
  433 |   }));
  434 | 
  435 |   await page.goto('/');
  436 |   await expect(page).toHaveURL(/\/$/);
  437 |   await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
  438 |   await page.waitForTimeout(500);
  439 |   expect(refreshRequests).toHaveLength(1);
  440 |   expect(mainFrameNavigations).toHaveLength(1);
  441 | });
  442 | 
  443 | test('concurrent expired API requests share one refresh and preserve the current route', async ({ page }) => {
  444 |   const state = makeApiState();
  445 |   state.messages.push({
  446 |     role: 'assistant',
  447 |     content: 'Restored conversation',
  448 |     createdAt: new Date().toISOString(),
  449 |   });
  450 |   const refreshRequests: number[] = [];
  451 |   const unauthorizedPaths = new Map([
  452 |     ['/subscription/status', 1],
  453 |     [`/ai/agent/conversations/${conversationId}`, 1],
  454 |   ]);
  455 |   await page.addInitScript((id) => {
  456 |     sessionStorage.setItem('workgrind_access_token', 'playwright-expired-access');
  457 |     sessionStorage.setItem('workgrind:ai:active-conversation:playwright-user', id);
  458 |   }, conversationId);
  459 |   await page.route('**/api/**', (route) => mockApi(route, {
  460 |     ...state,
  461 |     failSubscriptionRequestAt: undefined,
  462 |     failFirstAgentRequest: false,
  463 |     refreshDelayMs: 150,
  464 |     refreshRequests,
  465 |     unauthorizedPaths,
  466 |   }));
  467 |   await page.goto('/ai');
  468 | 
  469 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  470 |   await expect(page.getByText('Restored conversation')).toBeVisible();
  471 |   expect(refreshRequests).toHaveLength(1);
  472 |   await expect(page).toHaveURL(/\/ai$/);
  473 | });
  474 | 
  475 | test('login 401 is not retried with a stale access token', async ({ page }) => {
  476 |   await setSessionAuth(page);
  477 |   const refreshRequests: number[] = [];
  478 |   let loginRequests = 0;
  479 |   await page.route('**/api/**', async (route) => {
  480 |     const pathname = new URL(route.request().url()).pathname;
  481 |     if (pathname.endsWith('/auth/login')) {
  482 |       loginRequests += 1;
  483 |       await route.fulfill({
  484 |         status: 401,
  485 |         contentType: 'application/json',
  486 |         body: JSON.stringify({ success: false, message: 'Invalid credentials.' }),
  487 |       });
  488 |       return;
  489 |     }
  490 |     await mockApi(route, {
  491 |       ...makeApiState(),
  492 |       failSubscriptionRequestAt: undefined,
  493 |       failFirstAgentRequest: false,
  494 |       refreshRequests,
  495 |     });
  496 |   });
  497 |   await page.goto('/login');
  498 |   await page.getByLabel('Work email').fill('invalid@example.invalid');
  499 |   await page.locator('#login-password').fill('not-a-real-secret');
  500 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  501 | 
  502 |   await expect(page.getByRole('alert')).toContainText('Invalid credentials.');
  503 |   expect(loginRequests).toBe(1);
  504 |   expect(refreshRequests).toHaveLength(0);
  505 |   await expect(page).toHaveURL(/\/login$/);
  506 | });
  507 | 
  508 | test('logout does not refresh a session after its logout request is rejected', async ({ page }) => {
  509 |   await setSessionAuth(page);
  510 |   const refreshRequests: number[] = [];
  511 |   let logoutRequests = 0;
```