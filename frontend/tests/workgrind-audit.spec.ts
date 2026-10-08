import { expect, test, type Page, type Request } from '@playwright/test';

const publicPaths = [
  '/',
  '/about',
  '/features',
  '/demo',
  '/contact',
  '/pricing',
  '/privacy',
  '/terms',
  '/signup',
  '/login',
];

const authenticatedPaths = [
  '/dashboard',
  '/daily-focus',
  '/tasks',
  '/projects',
  '/calendar',
  '/crm',
  '/client-portal-mgmt',
  '/chat',
  '/meetings',
  '/whiteboard',
  '/docs',
  '/files',
  '/analytics',
  '/workflows',
  '/ai',
  '/team',
  '/notifications',
  '/billing',
  '/settings',
  '/calling',
  '/developer',
  '/developer/docs',
  '/sheets',
  '/moderation',
];

const oldBrandPattern = /\b(?:TeamFlow|Team Flow|TF)\b/i;

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

function safeText(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/g, '[token]')
    .replace(/\b(?:sk_(?:live|test)_|AIza)[A-Za-z0-9_-]{12,}\b/g, '[key]')
    .replace(/(password|token|secret|authorization)\s*[:=]\s*["']?[^ "'&,}]+/gi, '$1=[redacted]');
}

function trackRuntime(page: Page) {
  const issues: string[] = [];
  const requestStartedAt = new Map<Request, number>();
  const recordRequestStart = (request: Request) => requestStartedAt.set(request, Date.now());
  const recordRequestFailure = (request: Request) => {
    const failure = request.failure()?.errorText || 'request failed';
      if (failure.includes('ERR_ABORTED')) return;
    issues.push(`Request failed: ${request.method()} ${safeUrl(request.url())} (${failure})`);
  };
  const recordPageError = (error: Error) => issues.push(`Uncaught exception: ${error.name}: ${safeText(error.message)}`);
  const recordConsoleError = (message: import('@playwright/test').ConsoleMessage) => {
    if (message.type() === 'error') issues.push(`Console error: ${safeText(message.text())}`);
  };
  const recordResponse = (response: import('@playwright/test').Response) => {
    const startedAt = requestStartedAt.get(response.request());
    if (startedAt !== undefined && Date.now() - startedAt > 10_000) {
      issues.push(`Slow request (${Date.now() - startedAt}ms): ${safeUrl(response.url())}`);
    }
    if (response.status() >= 400) {
      issues.push(`${response.status()} ${response.request().method()} ${safeUrl(response.url())}`);
    }
  };
  const recordWebSocket = (socket: import('@playwright/test').WebSocket) => {
    socket.on('socketerror', (error) => issues.push(`WebSocket error: ${safeText(error)} (${safeUrl(socket.url())})`));
  };

  page.on('request', recordRequestStart);
  page.on('pageerror', recordPageError);
  page.on('console', recordConsoleError);
  page.on('requestfailed', recordRequestFailure);
  page.on('response', recordResponse);
  page.on('websocket', recordWebSocket);
  return {
    issues,
    stop: () => {
      page.off('request', recordRequestStart);
      page.off('pageerror', recordPageError);
      page.off('console', recordConsoleError);
      page.off('requestfailed', recordRequestFailure);
      page.off('response', recordResponse);
      page.off('websocket', recordWebSocket);
    },
  };
}

async function inspectPage(page: Page, path: string) {
  const runtime = trackRuntime(page);
  const startedAt = Date.now();
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => undefined);
  const elapsedMs = Date.now() - startedAt;
  const title = await page.title();
  const pageText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  const imageFailures = await page.locator('img').evaluateAll((images) =>
    images
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute('src') || image.getAttribute('alt') || '[image without source]')
  );
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const emptyLinks = await page.locator('a').evaluateAll((links) =>
    links.filter((link) => !link.getAttribute('href')).map((link) => link.textContent?.trim() || '[unnamed link]')
  );
  const internalLinks = await page.locator('a[href]').evaluateAll((links) =>
    [...new Set(links
      .map((link) => (link as HTMLAnchorElement).href)
      .filter((href) => {
        try {
          return new URL(href).origin === location.origin;
        } catch {
          return false;
        }
      })
      .map((href) => `${new URL(href).origin}${new URL(href).pathname}`))]
      .slice(0, 30)
  );
  const brokenInternalLinks: string[] = [];
  await Promise.all(
    internalLinks.map(async (href) => {
      try {
        const linkResponse = await page.request.get(href, { timeout: 10_000 });
        if (linkResponse.status() >= 400) brokenInternalLinks.push(`${linkResponse.status()} ${safeUrl(href)}`);
      } catch {
        brokenInternalLinks.push(`request failed ${safeUrl(href)}`);
      }
    })
  );
  const scripts = await page.locator('script[src]').evaluateAll((items) =>
    [...new Set(items
      .map((item) => (item as HTMLScriptElement).src)
      .filter((src) => {
        try {
          return new URL(src).origin === location.origin;
        } catch {
          return false;
        }
      }))]
  );
  const secretMarkers: string[] = [];
  for (const src of scripts) {
    try {
      const scriptResponse = await page.request.get(src, { timeout: 10_000 });
      const scriptText = await scriptResponse.text();
      const marker = scriptText.match(
        /(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|mongodb(?:\+srv)?:\/\/[^\s"'<>]{10,})/
      );
      if (marker) secretMarkers.push(`${safeUrl(src)} (${marker[0].startsWith('mongodb') ? 'database URI' : 'key/token marker'})`);
    } catch {
      // The browser network audit records failed resource requests separately.
    }
  }
  const unlabeledButtons = await page.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const hasName =
          button.textContent?.trim() ||
          button.getAttribute('aria-label') ||
          button.getAttribute('title') ||
          button.querySelector('img[alt], svg[aria-label], [aria-labelledby]');
        return !hasName;
      })
      .map((button) => button.outerHTML.slice(0, 240))
  );
  const oldBrandMatches = pageText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => oldBrandPattern.test(line))
    .map((line) => safeText(line).slice(0, 240));

  return {
    response,
    elapsedMs,
    status: response?.status() ?? null,
    securityHeaders: response ? await response.allHeaders() : {},
    title,
    pageText,
    imageFailures,
    overflow,
    emptyLinks,
    brokenInternalLinks,
    secretMarkers,
    unlabeledButtons,
    oldBrandMatches,
    runtimeIssues: runtime.issues,
    stopTracking: runtime.stop,
  };
}

test.describe('WorkGrind public-site audit', () => {
  for (const path of publicPaths) {
    test(`public page ${path}`, async ({ page }) => {
      const audit = await inspectPage(page, path);
      expect(audit.response, `${path} navigation returned no HTTP response`).not.toBeNull();
      expect(audit.response!.status(), `${path} navigation status`).toBeLessThan(400);
      expect(audit.title, `${path} should have a document title`).toBeTruthy();
      expect(audit.pageText.trim().length, `${path} should render visible content`).toBeGreaterThan(20);
      const issues = [
        ...audit.imageFailures.map((item) => `Broken image: ${item}`),
        ...(audit.overflow.scrollWidth > audit.overflow.clientWidth + 2
          ? [`Horizontal overflow: ${audit.overflow.scrollWidth}px content / ${audit.overflow.clientWidth}px viewport`]
          : []),
        ...audit.emptyLinks.map((item) => `Link without destination: ${item}`),
        ...audit.brokenInternalLinks.map((item) => `Broken internal link: ${item}`),
        ...audit.secretMarkers.map((item) => `Potential secret exposed in client bundle: ${item}`),
        ...audit.unlabeledButtons.map((item) => `Button without accessible name: ${safeText(item)}`),
        ...audit.oldBrandMatches.map((item) => `Old-brand text: ${item}`),
        ...audit.runtimeIssues,
      ];
      await test.info().attach('page-audit.json', {
        body: JSON.stringify({
          url: safeUrl(page.url()),
          path,
          status: audit.status,
          contentSecurityPolicy: Boolean(audit.securityHeaders['content-security-policy']),
          strictTransportSecurity: Boolean(audit.securityHeaders['strict-transport-security']),
          setCookieAttributes: (audit.securityHeaders['set-cookie'] || '')
            .split(/,(?=[^;]+=[^;]+)/)
            .filter(Boolean)
            .map((cookie) => ({
              secure: /;\s*secure\b/i.test(cookie),
              httpOnly: /;\s*httponly\b/i.test(cookie),
              sameSite: cookie.match(/;\s*samesite=([^;]+)/i)?.[1] || null,
            })),
          title: safeText(audit.title),
          elapsedMs: audit.elapsedMs,
          issues,
          oldBrandMatches: audit.oldBrandMatches,
        }, null, 2),
        contentType: 'application/json',
      });
      expect(issues, `${path} audit issues`).toEqual([]);
      test.info().annotations.push({ type: 'navigation-ms', description: String(audit.elapsedMs) });
      audit.stopTracking();
    });
  }
});

test('responsive layouts on key public pages', async ({ page }) => {
  const issues: string[] = [];
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 720 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const path of ['/', '/pricing', '/signup', '/login']) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        const sizes = await page.evaluate(() => ({
          body: document.body.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        if (sizes.body > sizes.viewport + 2) {
          issues.push(`${viewport.name} ${path}: ${sizes.body}px content exceeds ${sizes.viewport}px viewport`);
        }
      } catch (error) {
        issues.push(`${viewport.name} ${path}: ${error instanceof Error ? error.message : 'navigation failed'}`);
      }
    }
  }
  await test.info().attach('responsive-audit.json', {
    body: JSON.stringify({ issues }, null, 2),
    contentType: 'application/json',
  });
  expect(issues).toEqual([]);
});

test('login form exposes required email/password fields and blocks empty submission', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');
  await expect(email).toHaveCount(1);
  await expect(password).toHaveCount(1);
  await expect(page.locator('button[type="submit"]')).toHaveCount(1);
  expect(await email.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  expect(await password.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  await page.locator('button[type="submit"]').click();
  expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect(new URL(page.url()).pathname).toBe('/login');
});

test('protected application routes redirect unauthenticated visitors', async ({ page }) => {
  const results: Array<{ path: string; status: number | null; landedAt: string }> = [];
  const issues: string[] = [];
  for (const path of authenticatedPaths) {
    try {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      const landedAt = new URL(page.url()).pathname;
      results.push({ path, status: response?.status() ?? null, landedAt });
      if (!/\/login\/?$/.test(landedAt)) issues.push(`${path} resolved to ${landedAt}, not login`);
    } catch (error) {
      issues.push(`${path}: ${error instanceof Error ? safeText(error.message) : 'navigation failed'}`);
      results.push({ path, status: null, landedAt: safeUrl(page.url()) });
    }
  }
  await test.info().attach('protected-route-audit.json', {
    body: JSON.stringify({ results, issues }, null, 2),
    contentType: 'application/json',
  });
  expect(issues).toEqual([]);
});

test('authenticated routes and read-only feature audit', async ({ page }) => {
  const email = process.env.WORKGRIND_TEST_EMAIL;
  const password = process.env.WORKGRIND_TEST_PASSWORD;
  test.skip(!email || !password, 'Set WORKGRIND_TEST_EMAIL and WORKGRIND_TEST_PASSWORD in the environment to run authenticated checks.');

  const loginRuntime = trackRuntime(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });

  const storageState = await page.evaluate(() =>
    Object.keys(localStorage).map((name) => name.toLowerCase())
  );
  const cookies = await page.context().cookies();
  const authEvidence = {
    redirectedTo: safeUrl(page.url()),
    storageKeyNames: storageState.filter((name) => /auth|token|session/.test(name)),
    cookies: cookies
      .filter((cookie) => /auth|token|session/i.test(cookie.name))
      .map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite })),
  };
  test.info().annotations.push({
    type: 'session-evidence',
    description: JSON.stringify(authEvidence),
  });
  loginRuntime.stop();
  expect(loginRuntime.issues, 'Login console/network failures').toEqual([]);

  const routeProblems: string[] = [];
  const oldBrandFindings: string[] = [];
  for (const path of authenticatedPaths) {
    try {
      const audit = await inspectPage(page, path);
      const actualPath = new URL(page.url()).pathname;
      const visibleText = audit.pageText.trim();
      if (!audit.response || audit.response.status() >= 400) {
        routeProblems.push(`${path}: navigation failed (${audit.response?.status() ?? 'no response'})`);
      }
      if (actualPath !== path) routeProblems.push(`${path}: redirected to ${actualPath}`);
      if (visibleText.length < 20) routeProblems.push(`${path}: blank or nearly blank page`);
      if (audit.imageFailures.length) routeProblems.push(`${path}: ${audit.imageFailures.length} broken image(s)`);
      if (audit.overflow.scrollWidth > audit.overflow.clientWidth + 2) routeProblems.push(`${path}: horizontal overflow`);
      for (const issue of audit.runtimeIssues) routeProblems.push(`${path}: ${issue}`);
      if (audit.oldBrandMatches.length) oldBrandFindings.push(`${path}: ${audit.oldBrandMatches.join(', ')}`);
      await test.info().attach(`page-${path.replaceAll('/', '_') || 'dashboard'}.json`, {
        body: JSON.stringify({
          url: safeUrl(page.url()),
          path,
          status: audit.status,
          contentSecurityPolicy: Boolean(audit.securityHeaders['content-security-policy']),
          strictTransportSecurity: Boolean(audit.securityHeaders['strict-transport-security']),
          title: safeText(audit.title),
          elapsedMs: audit.elapsedMs,
          issues: [
            ...audit.imageFailures.map((item) => `Broken image: ${item}`),
            ...audit.brokenInternalLinks.map((item) => `Broken internal link: ${item}`),
            ...audit.secretMarkers.map((item) => `Potential secret exposed in client bundle: ${item}`),
            ...audit.unlabeledButtons.map((item) => `Button without accessible name: ${safeText(item)}`),
            ...audit.runtimeIssues,
          ],
          oldBrandMatches: audit.oldBrandMatches,
        }, null, 2),
        contentType: 'application/json',
      });
      audit.stopTracking();
      test.info().annotations.push({
        type: `route-${path}`,
        description: `${audit.response?.status() ?? 'no response'}; ${audit.elapsedMs}ms`,
      });
    } catch (error) {
      routeProblems.push(`${path}: navigation/inspection threw ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  expect(oldBrandFindings, 'Old branding on authenticated pages').toEqual([]);
  expect(routeProblems, 'Authenticated route issues').toEqual([]);
  await page.goto('/ai', { waitUntil: 'domcontentloaded' });
  const prompt = page.locator('textarea').first();
  await prompt.fill('Reply with the word OK.');
  const beforePrompt = await page.locator('body').innerText();
  const sentAt = Date.now();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect
    .poll(async () => {
      const text = await page.locator('body').innerText();
      return text !== beforePrompt && /\bOK\b/i.test(text);
    }, { timeout: 60_000 })
    .toBe(true);
  test.info().annotations.push({
    type: 'Tavro AI response latency-ms',
    description: String(Date.now() - sentAt),
  });
});

test('logout returns to the login screen when a logout control is available', async ({ page }) => {
  const email = process.env.WORKGRIND_TEST_EMAIL;
  const password = process.env.WORKGRIND_TEST_PASSWORD;
  test.skip(!email || !password, 'Set WORKGRIND_TEST_EMAIL and WORKGRIND_TEST_PASSWORD in the environment to run authenticated checks.');

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });

  const profileMenu = page.getByRole('button', { name: /my account/i }).first();
  if (await profileMenu.count()) await profileMenu.click();
  const logout = page.getByRole('menuitem', { name: /sign out/i }).first();
  if (await logout.count()) {
    await logout.click();
    await page.waitForURL(/\/login(?:$|[?#])/, { timeout: 15_000 });
  } else {
    test.info().annotations.push({
      type: 'logout',
      description: 'No visible logout button was discovered on the landing page.',
    });
  }
});
