# WorkGrind Defensive Security Audit

**Scope:** Bounded source/configuration review of this repository. This is not an exhaustive penetration test. No production systems, real secrets, or destructive migrations were used.

## Architecture and finding map

| Boundary / capability | Main implementation | Audit focus |
|---|---|---|
| Web application | `frontend` (Next.js) | Session handling, private-page caching, security headers |
| API and persistence | `backend/src/index.ts`, Express routes/controllers, Mongoose | Authentication, tenant scoping, role checks, rate limits |
| Authentication | `middleware/auth.ts`, `controllers/auth.controller.ts`, `services/oauth.ts` | JWT/session lifecycle, MFA, OAuth state and identity binding |
| Workspaces | `middleware/organizationAccess.ts`, `models/Company.ts`, domain controllers | Organization/role isolation and cross-tenant object access |
| File storage | `middleware/upload.ts`, `controllers/file.controller.ts`, `services/r2Storage.ts` | Upload content/size controls, private object access, download authorization |
| Realtime | `utils/socket.ts`, `utils/socketAuthorization.ts` | Socket identity, room joins, per-event authorization and tenant boundaries |
| Tavro AI | `ai/tools.ts`, `controllers/aiAgent.controller.ts`, `tavro-ai/src` | Server-derived tool context, data boundaries, privileged tool actions |
| Billing / integrations | `controllers/subscription.controller.ts`, `routes/subscription.ts` | Webhook verification/idempotency, billing authorization, outbound callbacks |
| Verification | `backend/tests`, `frontend/tests`, Tavro tests, package scripts | Existing automated coverage and focused regression opportunities |

Findings and evidence below are limited to behavior verified in the inspected source and tests. Items not fully validated are labeled as unresolved or untested rather than passed.

## Executive summary

Two high-impact authorization defects were confirmed and fixed:

1. Workspace users could retrieve private-channel details and message history without being channel members. `getChannel` only constrained the tenant; `getMessages` constrained messages to the tenant but did not require a channel ID or authorize the requested channel. Both now require an active, same-tenant public channel or a channel that includes the requester. History requires a valid channel ID.
2. Academic file downloads did not apply the academic uploader/share visibility filter, and file deletion accidentally replaced the edit-permission filter with the broader view-permission filter. Download now applies view scope; deletion composes the edit scope without overwriting it.

No claim is made that no other vulnerabilities exist. These changes address only the verified findings below and are covered by focused controller regression tests.

## Verified findings and remediation

### WG-SEC-00 — Critical — Vulnerable backend proxy address parser (fixed)

- **Evidence:** The production dependency tree contained `proxy-addr` 2.0.7, affected by GHSA-jqcg-44mw-7w3h. The Express application trusts the Vercel proxy chain in `backend/src/index.ts`; a forged forwarded address can undermine IP-based controls when the affected IPv4-mapped IPv6 trust-subnet condition is met.
- **Fix:** Applied the lockfile-compatible patch with `npm audit fix`; `proxy-addr` is now 2.0.8. No force upgrade or application API change was used.
- **Validation:** Re-ran the backend build and full `tests/*.test.cjs` suite after the update. The production-dependency audit no longer reports this critical advisory.

### WG-SEC-01 — High — Private-channel content disclosure (fixed)

- **Evidence before fix:** `backend/src/controllers/channel.controller.ts` (`getChannel`) queried only by channel ID and `companyId`. `getMessages` queried by `companyId` and an optional `channelId`, with no membership check; omitting the channel ID could also return all company messages, including messages not appropriate for channel-history access.
- **Impact:** An authenticated workspace member could enumerate/fetch private-channel metadata and read message content by supplying an object ID; an unfiltered history request could include messages from multiple conversation contexts.
- **Fix:** Both reads now require a same-workspace, non-archived channel that is public or lists the requester as a member. Message history rejects missing/invalid channel IDs and does not query messages when channel authorization fails.
- **Regression evidence:** `backend/tests/security-boundaries.test.cjs` tests denial before message queries, private-channel detail filtering, and required channel ID.

### WG-SEC-02 — High — Academic file visibility/edit checks missing or overridden (fixed)

- **Evidence before fix:** `backend/src/controllers/file.controller.ts` already applied `getAcademicFileAccessScope` to file listings and updates, but `downloadFile` did not apply it. In `deleteFile`, object-spreading both the edit and view scopes used the same `$or` key, so the later, broader view scope replaced the edit scope.
- **Impact:** A same-workspace academic user could download an unshared file by ID; a user with view-only sharing could delete a file they were not allowed to edit.
- **Fix:** Downloads now apply the view scope; deletes retain the edit scope as an explicit conjunctive filter.
- **Regression evidence:** `backend/tests/security-boundaries.test.cjs` asserts the exact uploader/shared-view and uploader/shared-edit filters.

## Other reviewed boundaries

- **Authentication / authorization:** `backend/src/middleware/auth.ts` verifies access JWTs, rejects MFA-pending tokens, reloads active/verified/deleted state and the current workspace/role from MongoDB, and compares the token workspace. `requireSuperAdmin` separately checks persisted super-admin status and MFA completion when enabled. JWT helpers fail closed when secrets are absent. Password, reset, refresh, and OAuth edge cases were not exhaustively penetration-tested.
- **Tenant access:** Route groups generally use `authenticate` and organization/entitlement guards; inspected file, task, project, approval, academic, client portal, and billing queries commonly scope by tenant ID. This is not a proof that every query is isolated; the private-channel and file issues above show why object-level access also needs focused tests.
- **OAuth:** `backend/src/services/oauth.ts` implements fixed provider endpoints, state/nonce/PKCE, redirect-origin/path validation, HTTPS requirements in production, timed provider fetches, and OIDC validation. `backend/src/controllers/oauth.controller.ts` uses one-time exchanges and separate client-audience handling. Live provider behavior and real-account linking were not tested.
- **Uploads / R2:** `backend/src/middleware/upload.ts` applies size/file-count limits plus extension and client MIME allowlists. `backend/src/controllers/file.controller.ts` and `backend/src/services/r2Storage.ts` store company-scoped object keys, check tenant scope before download, and issue short-lived signed downloads. No live R2 account, malware scanner, or byte-signature validation was tested.
- **Socket.IO:** `backend/src/utils/socket.ts` verifies JWTs and persisted user/workspace/subscription context at connection, refreshes authorization, checks channel membership and DM participation for joins, and validates meeting grants before sensitive events. Realtime behavior was source-reviewed; this task did not run a live multi-user Socket.IO attack test.
- **Tavro AI:** `backend/src/controllers/aiAgent.controller.ts` derives user/company context server-side and looks up conversations by both owner and tenant. `backend/src/ai/tools.ts` scopes workspace data queries and includes role/feature checks for sensitive tools. Prompt injection and external-provider data handling were not red-teamed.
- **Billing:** `backend/src/controllers/subscription.controller.ts` checks Polar HMAC signatures using constant-time comparison, enforces a five-minute timestamp window, validates product/workspace plan mapping, and claims delivery IDs for idempotency. No live Polar event was sent.
- **Headers / caching:** Production frontend CSP is generated in `frontend/src/proxy.ts` with a per-request nonce and restrictive directives. The backend disables Helmet CSP in `backend/src/index.ts`; the backend primarily returns API data and does not serve the frontend. The service worker restricts navigation caching to an explicit public allowlist in `frontend/public/sw.js`.

## Verification references

The source review used the **OWASP ASVS 5.0.0** verification domains and the **OWASP API Security Top 10 (2023)** as checklists, not as a certification or exhaustive control-by-control assessment.

- **API1: Broken Object Level Authorization / ASVS access control:** verified channel membership and academic file access gaps and added regression tests for these specific cases. Other object types still require systematic two-tenant tests.
- **API2: Broken Authentication:** inspected JWT reload, OAuth state/nonce/PKCE, and refresh paths; no end-to-end provider or production session test was run.
- **API3/API5: Broken Object Property / Function Level Authorization:** selected role and update allowlists were inspected; complete endpoint and mass-assignment coverage remains unverified.
- **API4: Unrestricted Resource Consumption:** existing request/upload limits and rate limiting were inspected; multi-instance enforcement and adversarial load were not tested.
- **API7/API10: SSRF / Unsafe Consumption of APIs:** outbound integrations and external provider boundaries need further destination and response validation review; no live upstream exercise was performed.
- **API8/API9: Security Misconfiguration / Improper Inventory Management:** Vercel and environment-dependent controls were documented for operator verification; no live deployment configuration was accessed.
- **API6: Sensitive Business Flows:** OAuth and Polar protections were inspected, but no live provider or race/replay test was conducted.

## Dependency audit results

Dependency audits were run with `npm audit --omit=dev --audit-level=high` after compatible updates:

- **Backend:** 5 production-tree advisories remain (4 High, 1 Moderate); the `proxy-addr` Critical advisory and compatible `qs`/`morgan` advisories were patched. Remaining High findings include the `agents`/MCP SDK dependency path and Nodemailer. npm indicates the available fixes require breaking-version changes; test compatibility before upgrading.
- **Frontend:** 21 production-tree advisories remain (10 High, 1 Critical, 8 Moderate, 2 Low). Compatible updates moved Next.js to 16.4.0, `sharp` to 0.35.5, and `source-map-js` to 1.2.2. The Critical `protobufjs` advisory remains transitively reachable through `@xenova/transformers` → `onnxruntime-web` → `onnx-proto`; npm's suggested remediation downgrades `@xenova/transformers` to a breaking release. Other remaining advisories include Excalidraw/Mermaid dependency paths and nested `sharp`/`uuid` packages.
- `npm audit fix` was run without `--force`; no automatic breaking-version remediation was applied. Review each dependency path and upgrade or replace it with compatibility tests.

OWASP references: [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) and [API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/).

## Unresolved findings and validation gaps

These were not changed because they require compatibility/deployment decisions or broader validation:

1. **Medium — Generic inbound integration webhook accepts requests without HMAC.** `backend/src/routes/integrations.ts` exposes `/webhook/:token` without user auth; `backend/src/controllers/integration.controller.ts` verifies HMAC only when a signature header is supplied. The URL token is generated with high entropy and acts as a bearer credential, but an exposed token permits forged realtime webhook events. Require signatures after confirming all existing webhook senders can be migrated; test rotation and legacy integrations.
2. **Medium — Proxy/rate-limit configuration is deployment-sensitive.** `backend/src/index.ts` trusts the proxy chain in Vercel (`trust proxy: true`) and local loopback otherwise; `backend/src/middleware/rateLimiter.ts` uses the default in-memory store. Confirm the deployed edge overwrites forwarded client-IP headers, and use a shared store if limits must apply globally across serverless instances.
3. **Low/Medium — Upload allowlists trust client-declared MIME and extension.** `backend/src/middleware/upload.ts` does not inspect file signatures. Download defenses (`attachment` for R2 and `nosniff` for local files) reduce browser execution risk, but do not establish that uploaded content matches its declared type. Consider magic-byte validation and malware scanning based on supported business requirements.
4. **Unverified billing reliability concern — Raw-body capture ordering.** `backend/src/index.ts` installs `express.json()` before mounting `subscriptionRoutes`; `backend/src/routes/subscription.ts` then installs `express.raw()` for the webhook and expects a Buffer. Validate an actual signed Polar test event in an isolated sandbox to ensure the raw bytes survive this middleware order. This is recorded as an integration test gap, not a confirmed signature bypass.
5. **High/Critical dependency findings remain:** see the dependency audit results above; notably the frontend transitive `protobufjs` Critical advisory and the backend MCP SDK/Nodemailer High advisories. The available fixes identified by npm require breaking dependency changes and were not forced.
6. **Coverage gap:** This audit did not use production credentials, inspect or print `.env` values, access live customer data, exercise live OAuth/payment providers, run a full browser authentication flow, or conduct fuzzing/load/penetration tests. There is no claim of exhaustive testing.

## Prioritized follow-up plan

1. **P0 — Critical dependency remediation:** replace or safely upgrade the frontend `@xenova/transformers` / ONNX dependency path so the vulnerable `protobufjs` is no longer installed; test local AI functionality and the production build. Do not force the suggested downgrade.
2. **P1 — Remaining High dependencies:** plan a compatible `agents`/MCP SDK upgrade and Nodemailer upgrade; add Tavro and mail-flow compatibility tests before changing their major versions.
3. **P1 — Inbound integration authentication:** inventory active webhook consumers, define a signed-request migration/version policy, then require HMAC and add invalid-signature/replay tests without silently breaking existing integrations.
4. **P1 — Tenant coverage:** add disposable-database tests with two organizations and multiple roles across files, tasks/projects, CRM, academic records, channels, API routes, and socket events.
5. **P2 — Upload and platform controls:** validate file signatures with a supported library; verify proxy-header handling and distributed rate-limit requirements against deployment configuration.
6. **P2 — Provider integration checks:** verify Polar raw-body/signature behavior with a sandbox event and exercise OAuth, R2, and realtime flows using test accounts.
7. **P2 — Completion evidence:** run the full ASVS 5.0.0/API Security Top 10 control matrix, static security analysis and secret scanning in CI, recording exceptions rather than treating them as passed.

## Validation performed

- `Set-Location backend; npm run test:auth-refresh` — passed after dependency updates and the added cross-workspace cases; 110 tests passed, 0 failed (the script also builds TypeScript).
- Focused backend boundary rerun — 23 passed, 0 failed.
- Frontend `npm run build` — passed after compatible lockfile updates (Next.js 16.4.0), generating 103 pages.
- Frontend `npm run lint` — failed with 358 errors and 214 warnings across the frontend tree; this security change did not alter frontend source files.
- Production dependency audits — backend 5 and frontend 21 advisories remain at the severities listed above; audit commands return nonzero because unresolved advisories remain.
- `gitleaks`, `trufflehog`, and `semgrep` were not installed in the environment; no source secret scan or SAST run is claimed.
- Tests use mocked model queries and do not connect to a database or external service.
