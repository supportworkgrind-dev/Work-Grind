# WorkGrind A-to-Z Audit Report

**Audit date:** 2026-10-01  
**Scope:** Read-only source/configuration review and non-destructive build, health, and browser smoke checks. No application code was modified.

## Executive summary

The checked application builds and its tunneled health/API/socket paths were operational during the audit. Separate Sarah and Alex browser sessions authenticated as different users, connected with distinct Socket.IO IDs, and resolved each other's Calling IDs. The Calling page did not overflow horizontally at a 390 px viewport.

The highest-priority verified risk is the low-entropy, static JWT signing configuration loaded from the local backend environment while the application is tunnel-accessible. Other verified concerns include authenticated-page service-worker caching, rate-limit proxy configuration, API routes mounted ahead of the intended general API limiter, missing CSP/SEO discovery endpoints, a lint command that scans generated dev output, and absent first-party automated tests.

This is not a claim that every control, page, button, and workflow was exhaustively penetrated or manually tested. The report distinguishes verified issues from untested areas.

## Findings

### 1. Security vulnerabilities / hardening

#### S1 — High: static, guessable JWT signing secrets in the active local configuration

- **Location:** `backend/.env:4-5`; token verification/signing is centralized in `backend/src/utils/jwt.ts`.
- **Evidence:** The backend loads this environment file at startup. Its access- and refresh-token secrets are fixed, human-readable strings rather than generated random secret material. The backend was reachable through the frontend Dev Tunnel during the audit.
- **Impact:** If an attacker can infer/guess the signing secret, they may be able to forge access tokens and impersonate users. The root `.gitignore` excludes `.env`, so this audit does **not** conclude that these values are committed or publicly leaked.
- **Recommended fix:** Replace both with independently generated high-entropy secrets; rotate outstanding sessions/tokens; use a protected secret manager in deployed environments; ensure no tunnel or public environment uses development secrets.
- **Confidence:** High.

#### S2 — Medium: no Content Security Policy is emitted

- **Location:** `backend/src/index.ts:153`; frontend security headers in `frontend/next.config.mjs` (headers list).
- **Evidence:** Helmet explicitly sets `contentSecurityPolicy: false`; the Next.js header configuration does not define `Content-Security-Policy`. The tunneled production response was checked: it included `X-Content-Type-Options`, `X-Frame-Options`, HSTS, and referrer policy, but no CSP header.
- **Impact:** This removes a useful defense-in-depth control against script injection and content loading from unexpected origins. No XSS exploit was established during this audit.
- **Recommended fix:** Design and roll out a production CSP compatible with Next.js, required script/style handling, media/WebRTC, and configured integrations; validate it in report-only mode before enforcement.
- **Confidence:** High.

#### S3 — Medium: service worker caches successful authenticated navigations without user partitioning

- **Location:** `frontend/public/sw.js:138-155`.
- **Evidence:** Every successful navigation response is cached using the request URL as the cache key; on network failure, that exact cached response or the cached root shell is returned. API and Socket.IO requests are excluded, but authenticated page navigations are not.
- **Impact:** The cache is origin-wide rather than account-specific. A shared browser profile can reuse a previously cached authenticated route after an account switch or while offline. Whether the cached HTML contains sensitive data depends on the rendered route; cross-account private-data exposure was not demonstrated.
- **Recommended fix:** Do not cache authenticated/private navigation responses. If offline private pages are a product requirement, partition and invalidate them by authenticated identity and clear the private cache on logout/account change.
- **Confidence:** High for the caching behavior; Medium for data exposure impact.

#### S4 — Medium: reverse-proxy headers are not trusted/configured for rate limiting

- **Location:** `backend/src/index.ts:127, 251-262`; `backend/src/middleware/rateLimiter.ts:10-15`.
- **Evidence:** The Express app has no `trust proxy` configuration. Requests arriving through the Dev Tunnel included `X-Forwarded-For`; the running backend emitted express-rate-limit's `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` validation error. The limiter uses the library's default key generator.
- **Impact:** Client IP attribution and IP-based limiting can be inaccurate behind the tunnel/reverse proxy; requests may share an address or be limited under the wrong address.
- **Recommended fix:** Configure trust only for the known proxy hop(s) or use a validated custom key generator; confirm rate limits with proxied and direct test requests. Do not blindly trust arbitrary forwarded headers.
- **Confidence:** High.

### 2. Critical errors / confirmed backend routing issue

#### B1 — Medium: call routes are mounted before the general `/api` rate limiter

- **Location:** `backend/src/index.ts:255, 262, 298`; endpoint-specific limits are in `backend/src/routes/calls.ts:18-25`.
- **Evidence:** `callingRoutes` is mounted at line 255 before the general `/api` limiter at line 262, then mounted a second time after the limiter at line 298. Registered handlers in the first mount respond before reaching the general limiter. Only call creation and acceptance have route-level limiters; history, CRM call notes, token refresh, and terminal actions do not.
- **Impact:** Those registered call endpoints bypass the intended general API throttle, increasing exposure to authenticated request floods.
- **Recommended fix:** Remove the early mount and retain a single mount after the common limiter, or add appropriate endpoint-specific limits before the early mount is removed.
- **Confidence:** High.

#### B2 — Low: duplicate approval route registration

- **Location:** `backend/src/index.ts:294-295`.
- **Evidence:** The same approval router is mounted twice at the same base path.
- **Impact:** Most responding handlers will terminate in the first router, so no duplicate side effect was observed. The redundant registration is confusing and can cause requests that call `next()` to traverse the router twice.
- **Recommended fix:** Keep one mount and add a route-mount smoke test.
- **Confidence:** High.

### 3. Broken or incomplete features / missing verification

#### T1 — Medium: no first-party automated test suite or test scripts were found

- **Location:** `frontend/package.json: scripts`; `backend/package.json: scripts`; source trees `frontend/src` and `backend/src`.
- **Evidence:** Neither package defines a `test` script. No `.test.*` or `.spec.*` files were found under either application source tree, and no root `.github` CI workflow directory was present.
- **Impact:** Authentication, tenant boundaries, Calling/Meetings, payments, and client/admin portal changes have no visible automated regression gate in the inspected project.
- **Recommended fix:** Add focused backend authorization/API tests and isolated two-user realtime E2E tests, then run them in CI for pull requests.
- **Confidence:** High for the inspected source/manifests; tests outside those trees were not ruled out.

### 4. UI/UX and responsive behavior

- **No specific UI defect was confirmed in the sampled route.** At a 390 × 844 viewport, `/calling` reported no horizontal document overflow.
- The full responsive behavior of all pages, modal focus management, keyboard-only navigation, screen-reader output, form validation, and every button state was not manually exercised. No accessibility scan/axe suite was configured or run, so those areas remain unverified rather than passed.

### 5. Performance / developer workflow

#### P1 — Low: frontend lint scans generated `.next-dev` output

- **Location:** `frontend/package.json:9`; `frontend/eslint.config.mjs:8-13`.
- **Evidence:** The lint script runs `eslint .`. The flat-config ignore list excludes `.next/**` but not the configured `.next-dev/**` output. Running `npm run lint` emitted ESLint warnings from generated `.next-dev/dev/...` bundles and had not completed after more than two minutes; the run was stopped.
- **Impact:** Lint work is wasted on generated artifacts and may become slow/noisy or fail on dependency-generated content.
- **Recommended fix:** Ignore `.next-dev/**` and other generated output directories in the ESLint flat config; rerun lint on source files.
- **Confidence:** High.

### 6. SEO / discoverability

#### E1 — Low: robots and sitemap endpoints return 404

- **Location:** `frontend/src/app/layout.tsx:20-46` (global metadata); no `robots.ts`, `sitemap.ts`, `public/robots.txt`, or `public/sitemap.xml` was found.
- **Evidence:** Requests to `/robots.txt` and `/sitemap.xml` on the live frontend tunnel returned 404. The manifest and configured PWA icons returned 200.
- **Impact:** Search crawlers have no explicit crawl policy or sitemap to discover public pages. This does not affect authenticated application operation.
- **Recommended fix:** Add a robots policy and sitemap for intended public marketing routes only; exclude authenticated/admin/client-private routes.
- **Confidence:** High.

## Areas checked and observed results

| Area | Checks performed | Result / boundary |
|---|---|---|
| Frontend TypeScript | `npx tsc --noEmit` | Passed |
| Frontend production build | `npm run build` in the preceding tunnel configuration work; no frontend source changes occurred during this audit | Passed |
| Backend TypeScript build | `npm run build` | Passed |
| Frontend lint | `npm run lint` | Did not complete within >2 minutes; generated `.next-dev` lint warnings observed; command stopped |
| Backend health/database | `GET /api/health` through frontend tunnel | 200; database reported connected |
| API authentication | Independent Sarah and Alex sessions, each `GET /api/auth/me` | Both returned 200 and the expected separate user identities |
| Socket.IO | Same two independent browser sessions | Both connected, distinct socket IDs, WebSocket transport |
| Calling | Cross-lookups for `WG-39885` and `WG-72646` | Each lookup resolved the other account and returned availability |
| Calling media | No live audio/microphone session in this audit | Not verified |
| Meetings | No cross-account media meeting run in this audit | Not verified |
| Mobile | `/calling` at 390 px viewport | No horizontal overflow; other routes not measured |
| PWA | Manifest and common PNG icons via tunnel | Returned 200; authenticated navigation cache policy reviewed statically |
| Payments | No checkout, cancellation, coupon, or webhook state changes performed | Not exercised |
| Admin/client portals, forms, navigation, AI integrations | Static review only; no exhaustive interaction sweep | Not fully verified |

## A–Z summary

- **A — Accessibility:** No verified defect from a complete screen-reader/keyboard audit; full audit not run.
- **B — Backend:** TypeScript build passes; duplicate route mounting and call-route limiter ordering require cleanup.
- **C — Calling:** Two-user lookup and authenticated Socket.IO connectivity passed; live media not tested.
- **D — Database:** Health endpoint reported connected during the check; schema migration/restore/backup procedures were not exercised.
- **E — SEO:** `/robots.txt` and `/sitemap.xml` return 404.
- **F — Files:** Authenticated download/company isolation patterns were inspected; upload/download end-to-end was not exercised.
- **G — Global security headers:** CSP absent; other sampled headers were present.
- **H — HTTP/API:** Authenticated `/api/auth/me` and health endpoints worked through the frontend tunnel.
- **I — Integrations:** Not exhaustively exercised.
- **J — Jobs/background work:** Not exhaustively exercised.
- **K — Keys/secrets:** Active `.env` JWT signing secrets are static and human-readable; rotate/use managed random secrets.
- **L — Lint:** Lint traverses generated `.next-dev` output and did not finish during the audit window.
- **M — Mobile:** Sampled Calling page has no horizontal overflow at 390 px; broader device coverage remains.
- **N — Navigation:** Routes were not exhaustively traversed; duplicate approval mounting is confirmed.
- **O — Observability:** Proxy/rate-limit configuration warning observed; full monitoring/alerting not assessed.
- **P — Performance:** No full bundle/Lighthouse profiling; lint generated-file overhead confirmed.
- **Q — Quality:** No app-source automated tests/test scripts found in inspected manifests/source trees.
- **R — Realtime:** Both independent authenticated sockets connected; reconnect/media edge cases not re-run.
- **S — Service worker:** Offline navigation cache is not partitioned by account and includes private paths.
- **T — Tenancy/auth:** Sarah and Alex resolved independently in `/auth/me`; complete endpoint-by-endpoint authorization testing remains.
- **U — Usability:** All forms/buttons/loading/error states were not exhaustively clicked/tested.
- **V — Video/Meetings:** No live A↔B media verification in this audit.
- **W — Web security:** CSP and weak signing secrets are priorities; no exploit beyond configuration risks was attempted.
- **X — Cross-browser:** Not tested beyond the integrated browser contexts.
- **Y — Yield/deployment:** Trust-proxy/rate-limit configuration needs production proxy validation.
- **Z — Zero-downtime/recovery:** Deployment rollback, backup restore, and load testing were outside this audit.

## Prioritized fix checklist

1. **High:** Rotate JWT signing secrets to random high-entropy values and invalidate tokens issued under the prior secrets.
2. **Medium:** Fix Express trusted-proxy/rate-limit IP handling for the actual deployment topology.
3. **Medium:** Move the early `/api/calls` mount behind the global API limiter; retain one call-router mount; remove the duplicate approvals mount.
4. **Medium:** Restrict service-worker caching to explicitly public pages and invalidate any private cache on logout/account switch.
5. **Medium:** Add isolated backend authorization tests and two-account realtime E2E coverage in CI.
6. **Medium:** Define and test a production CSP.
7. **Low:** Exclude `.next-dev/**` from ESLint and make the lint command finish on source only.
8. **Low:** Add robots and sitemap endpoints for public content, excluding private application routes.

