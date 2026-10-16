# WorkGrind Threat Model

**Purpose:** A bounded model of the repository's primary security boundaries. This document supports defensive design and test planning; it is not a complete system certification.

## System and data

WorkGrind is a multi-tenant workspace application with:

- A Next.js frontend (`frontend`) that calls an Express/Mongoose API (`backend`).
- JWT-authenticated workspace identities and organization/role-based features.
- A separate client-portal identity and token path.
- MongoDB-backed collaboration, billing, identity, and workspace records; optional Redis and Socket.IO coordination.
- Private file storage through Cloudflare R2 (or a local fallback).
- OAuth/OIDC providers, Polar billing, configurable inbound integration webhooks, and external AI providers for Tavro.
- Socket.IO collaboration, chat, meetings, and calling.

## Assets to protect

- User credentials, access/refresh tokens, MFA factors, OAuth tokens, invitation/reset tokens.
- Tenant boundaries and workspace data, including private channels, DMs, academic records, CRM, tasks, meetings, and files.
- Client-portal data and its distinct identity boundary.
- Billing/subscription state and webhook idempotency records.
- Provider credentials, uploaded objects, call/meeting grants, and realtime presence.
- Integrity and availability of the API, AI tools, and collaboration events.

## Trust boundaries

1. **Internet to frontend/API:** requests may be anonymous, malformed, automated, or carry forged forwarding headers.
2. **User to workspace:** an authenticated user may intentionally probe another member's private records, object IDs, features, or role restrictions.
3. **WorkGrind user to client portal:** external clients have a separate account/token model and must not inherit workspace-user privileges.
4. **Provider to callback/webhook:** OAuth and billing callbacks are untrusted until state/signature, timestamp, identity, audience, and event mapping checks succeed.
5. **Application to data/storage:** MongoDB, Redis, R2, and Socket.IO adapters hold cross-tenant state and require server-derived tenant scope.
6. **Application to AI/provider:** prompts and retrieved content may be adversarial; model output and tool arguments are untrusted input.
7. **User-configured integrations:** webhook tokens/URLs are credentials and destinations that can be exposed through external configuration or logs.

## Threat actors and relevant abuse cases

| Actor | Threats considered |
|---|---|
| Unauthenticated Internet user | Credential stuffing, token guessing, oversized upload/request abuse, webhook probing, malformed callback input |
| Malicious authenticated tenant member | IDOR/BOLA, private-channel/file enumeration, privilege escalation, cross-tenant object references, realtime room joins |
| Compromised account or browser | Session reuse, unauthorized file retrieval, OAuth account-linking abuse, client/workspace identity confusion |
| Compromised or misconfigured provider/integration | Forged callbacks/events, stale OAuth grants, billing-state manipulation, malicious uploaded or provider-returned content |
| Prompt-injection content or malicious AI user | Tool misuse, attempts to override role/tenant context, disclosure of retrieved private data |
| Deployment/configuration error | Weak or reused signing secrets, open storage, overbroad proxy trust, missing HTTPS, broken webhook verification |

## Existing defenses observed in source

- `backend/src/middleware/auth.ts` verifies access tokens and reloads active user and workspace membership from the database. Organization and entitlement middleware provide additional feature gates.
- Domain reads and writes commonly constrain records using the authenticated tenant ID. The audit fixed two discovered object-level gaps documented in `SECURITY_AUDIT.md`.
- OAuth (`backend/src/services/oauth.ts`) uses provider-pinned endpoints, state/nonce/PKCE, callback validation, and OIDC claim/signature checks; the controller uses single-use exchanges and a distinct client audience.
- R2 objects are private by design, use tenant-prefixed keys, and downloads require an authorized database record before short-lived signing.
- Socket connections and sensitive room joins/events are tied to persisted user/workspace/subscription and object-level membership/access checks.
- Tavro context is constructed by the backend; its tools scope queries by `companyId` and apply role/availability rules.
- Polar billing webhooks use HMAC/timestamp checks and delivery claims; ordinary billing mutations are protected by authentication and billing roles.
- The production frontend emits a nonce-based CSP. Public navigation caching is allowlisted in the service worker.

## Residual risks and assumptions

- Tenant correctness still depends on every controller/query adding object-level scope; a source review cannot prove all endpoints or combinations are safe.
- The generic inbound integration endpoint now requires a valid HMAC in addition to its high-entropy URL token; test that all current senders sign requests before rollout.
- Vercel trusts one proxy hop. Valid `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` backend settings enable shared rate-limit counters. If Redis is missing or unavailable, `express-rate-limit` continues using per-process counters; serverless instances do not coordinate those fallback limits.
- Upload routes validate content signatures against allowed MIME/extension pairs, but do not scan for malware.
- Production OAuth, billing, webhook, storage, proxy, and realtime settings were not exercised with real provider accounts. Polar signature interoperability still needs a sandbox test.
- AI prompt injection, browser/client manipulation, concurrency races, and resource-exhaustion behaviors require adversarial integration testing.
- This model does not cover infrastructure/vendor controls, employee access, incident response, backups, disaster recovery, or live production configuration.

## Security objectives

1. A user can read or mutate only records they are authorized to access within their workspace and role.
2. OAuth, billing, and integration events cannot create identity or billing state without their expected proof of origin and freshness.
3. Private files remain private at both database lookup and object-storage delivery boundaries.
4. Realtime and AI operations cannot elevate client-provided tenant, identity, role, or entitlement claims.
5. Production secret, network, storage, and proxy configuration fail closed and can be verified without exposing secret values.
