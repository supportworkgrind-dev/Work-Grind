# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> Billing handles an account with no subscription record without fabricating a plan
- Location: tests\billing-ai-regressions.spec.ts:310:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Workspace Subscription', exact: true })
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Workspace Subscription', exact: true }) with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Workspace Subscription', exact: true })
  - Test timeout of 60000ms exceeded.

```

```yaml
- img "WorkGrind"
- alert
```

# Test source

```ts
  221 |     };
  222 |     options.agentRequests.push(body);
  223 |     if (options.failFirstAgentRequest && options.agentRequests.length === 1) {
  224 |       await route.fulfill({
  225 |         status: 503,
  226 |         headers,
  227 |         contentType: 'application/json',
  228 |         body: JSON.stringify({ success: false, message: 'Tavro AI is temporarily unavailable. Please retry.' }),
  229 |       });
  230 |       return;
  231 |     }
  232 |     const now = new Date().toISOString();
  233 |     options.messages.push(
  234 |       { role: 'user', content: body.message || '', createdAt: now },
  235 |       { role: 'assistant', content: 'OK response', createdAt: now }
  236 |     );
  237 |     const answer = 'OK response';
  238 |     const responseEvents = [
  239 |       `event: ready\ndata: ${JSON.stringify({ conversationId })}\n\n`,
  240 |       `event: delta\ndata: ${JSON.stringify({ text: answer })}\n\n`,
  241 |       `event: done\ndata: ${JSON.stringify({ conversationId, provider: 'gemini', toolSteps: [], tokensUsed: 1 })}\n\n`,
  242 |     ].join('');
  243 |     await route.fulfill({
  244 |       status: 200,
  245 |       headers,
  246 |       contentType: 'text/event-stream',
  247 |       body: responseEvents,
  248 |     });
  249 |     return;
  250 |   }
  251 | 
  252 |   await route.fulfill({
  253 |     status: 200,
  254 |     headers,
  255 |     contentType: 'application/json',
  256 |     body: JSON.stringify({ success: true, data: [], items: [], members: [], notifications: [] }),
  257 |   });
  258 | }
  259 | 
  260 | function makeApiState() {
  261 |   return {
  262 |     messages: [] as AgentMessage[],
  263 |     subscriptionRequests: [] as number[],
  264 |     planRequests: [] as number[],
  265 |     agentRequests: [] as Array<{ conversationId?: string; history?: AgentMessage[]; message?: string }>,
  266 |   };
  267 | }
  268 | 
  269 | test('Billing renders after its initial data fetch without repeatedly remounting or refetching', async ({ page }) => {
  270 |   const state = makeApiState();
  271 |   await setSessionAuth(page);
  272 |   await page.route('**/api/**', (route) => mockApi(route, {
  273 |     ...state,
  274 |     failSubscriptionRequestAt: undefined,
  275 |     failFirstAgentRequest: false,
  276 |   }));
  277 |   await page.goto('/billing');
  278 | 
  279 |   await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
  280 |   await expect(page.getByText('Workspace Plan')).toBeVisible();
  281 |   await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible();
  282 |   await page.waitForTimeout(1200);
  283 |   const settledSubscriptionRequests = state.subscriptionRequests.length;
  284 |   const settledPlanRequests = state.planRequests.length;
  285 |   await page.waitForTimeout(1500);
  286 | 
  287 |   expect(state.subscriptionRequests.length).toBe(settledSubscriptionRequests);
  288 |   expect(state.planRequests.length).toBe(settledPlanRequests);
  289 |   expect(settledSubscriptionRequests).toBeLessThanOrEqual(3);
  290 |   expect(settledPlanRequests).toBeLessThanOrEqual(2);
  291 |   await expect(page).toHaveURL(/\/billing$/);
  292 | });
  293 | 
  294 | test('Billing shows a retry state after a temporary subscription API failure', async ({ page }) => {
  295 |   const state = makeApiState();
  296 |   await setSessionAuth(page);
  297 |   await page.route('**/api/**', (route) => mockApi(route, {
  298 |     ...state,
  299 |     failSubscriptionRequestAt: 2,
  300 |     failFirstAgentRequest: false,
  301 |   }));
  302 |   await page.goto('/billing');
  303 | 
  304 |   await expect(page.locator('div[role="alert"].alert-danger')).toContainText(/Could not load|temporarily unavailable/i);
  305 |   await page.getByRole('button', { name: 'Retry loading billing data' }).click();
  306 |   await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
  307 |   await expect(page.getByText('Workspace Plan')).toBeVisible();
  308 | });
  309 | 
  310 | test('Billing handles an account with no subscription record without fabricating a plan', async ({ page }) => {
  311 |   const state = makeApiState();
  312 |   await setSessionAuth(page);
  313 |   await page.route('**/api/**', (route) => mockApi(route, {
  314 |     ...state,
  315 |     failSubscriptionRequestAt: undefined,
  316 |     failFirstAgentRequest: false,
  317 |     noSubscriptionRecord: true,
  318 |   }));
  319 |   await page.goto('/billing');
  320 | 
> 321 |   await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
      |                                                                                            ^ Error: expect(locator).toBeVisible() failed
  322 |   await expect(page.getByRole('status')).toContainText('No subscription record is associated');
  323 |   await expect(page.getByText('No subscription', { exact: true })).toBeVisible();
  324 |   await expect(page.getByText('Available as a 7-day trial')).toBeVisible();
  325 | });
  326 | 
  327 | test('Tavro keeps the same conversation through the subscription refresh and restores it after reload', async ({ page }) => {
  328 |   const state = makeApiState();
  329 |   await setSessionAuth(page);
  330 |   await page.route('**/api/**', (route) => mockApi(route, {
  331 |     ...state,
  332 |     failSubscriptionRequestAt: undefined,
  333 |     failFirstAgentRequest: false,
  334 |   }));
  335 |   await page.goto('/ai');
  336 |   const composer = page.getByPlaceholder(/Ask me to find tasks/);
  337 |   await expect(composer).toBeVisible();
  338 |   await composer.fill('Reply with the word OK.');
  339 |   const navigationCount = { value: 0 };
  340 |   page.on('framenavigated', (frame) => {
  341 |     if (frame === page.mainFrame()) navigationCount.value += 1;
  342 |   });
  343 |   const mainFrameNavigations = navigationCount.value;
  344 |   await page.getByRole('button', { name: 'Send' }).click();
  345 |   await expect(page.getByText('OK response').first()).toBeVisible();
  346 |   await expect.poll(() => state.agentRequests.length).toBe(1);
  347 |   expect(state.agentRequests[0].conversationId).toBeUndefined();
  348 |   expect(navigationCount.value).toBe(mainFrameNavigations);
  349 |   await expect(page).toHaveURL(/\/ai$/);
  350 | 
  351 |   await page.reload();
  352 |   const restoredComposer = page.getByPlaceholder(/Ask me to find tasks/);
  353 |   await expect(restoredComposer).toBeVisible();
  354 |   await expect(page.getByText('Reply with the word OK.')).toBeVisible();
  355 |   await expect(page.getByText('OK response').first()).toBeVisible();
  356 | 
  357 |   await restoredComposer.fill('Continue in this same conversation.');
  358 |   await page.getByRole('button', { name: 'Send' }).click();
  359 |   await expect.poll(() => state.agentRequests.length).toBe(2);
  360 |   expect(state.agentRequests[1].conversationId).toBe(conversationId);
  361 |   await expect(page.getByText('Continue in this same conversation.')).toBeVisible();
  362 |   await expect(page.getByText('OK response').last()).toBeVisible();
  363 |   await expect(page).toHaveURL(/\/ai$/);
  364 | });
  365 | 
  366 | test('Tavro remains on the same route when /auth/me recovers through refresh', async ({ page }) => {
  367 |   const state = makeApiState();
  368 |   const currentUser401 = { value: false };
  369 |   const refreshRequests: number[] = [];
  370 |   const currentUserTokens: string[] = [];
  371 |   await setSessionAuth(page);
  372 |   await page.route('**/api/**', async (route) => {
  373 |     await mockApi(route, {
  374 |       ...state,
  375 |       failSubscriptionRequestAt: undefined,
  376 |       failFirstAgentRequest: false,
  377 |       expireCurrentUserOnce: currentUser401,
  378 |       currentUserTokens,
  379 |       refreshRequests,
  380 |     });
  381 |   });
  382 |   await page.goto('/ai');
  383 | 
  384 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  385 |   await expect(page).toHaveURL(/\/ai$/);
  386 |   expect(refreshRequests).toHaveLength(1);
  387 |   expect(currentUser401.value).toBe(true);
  388 |   expect(currentUserTokens[0]).toBe('Bearer playwright-regression-access');
  389 |   expect(currentUserTokens).toHaveLength(2);
  390 |   expect(currentUserTokens.slice(1).every((token) => token === 'Bearer playwright-refreshed-access')).toBe(true);
  391 | });
  392 | 
  393 | test('repeatedly rejected refreshed sessions stop after one token-change retry', async ({ page }) => {
  394 |   const currentUserTokens: string[] = [];
  395 |   const refreshTokens: string[] = [];
  396 |   await setSessionAuth(page);
  397 |   await page.route('**/api/**', async (route) => {
  398 |     const request = route.request();
  399 |     const pathname = new URL(request.url()).pathname;
  400 |     if (pathname.endsWith('/auth/me')) {
  401 |       currentUserTokens.push(request.headers().authorization ?? '');
  402 |       await route.fulfill({
  403 |         status: 401,
  404 |         contentType: 'application/json',
  405 |         body: JSON.stringify({ success: false, message: 'Invalid or expired token' }),
  406 |       });
  407 |       return;
  408 |     }
  409 |     if (pathname.endsWith('/auth/refresh')) {
  410 |       const accessToken = `playwright-refreshed-access-${refreshTokens.length + 1}`;
  411 |       refreshTokens.push(accessToken);
  412 |       await route.fulfill({
  413 |         status: 200,
  414 |         contentType: 'application/json',
  415 |         body: JSON.stringify({ success: true, accessToken }),
  416 |       });
  417 |       return;
  418 |     }
  419 |     await route.fulfill({
  420 |       status: 200,
  421 |       contentType: 'application/json',
```