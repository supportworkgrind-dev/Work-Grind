# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> verified signup creates its workspace with the authenticated owner and stores the rotated access token
- Location: tests\billing-ai-regressions.spec.ts:521:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "Bearer playwright-regression-access"
Received: ""

Call Log:
- Timeout 15000ms exceeded while waiting on the predicate
```

```
Tearing down "context" exceeded the test timeout of 60000ms.
```