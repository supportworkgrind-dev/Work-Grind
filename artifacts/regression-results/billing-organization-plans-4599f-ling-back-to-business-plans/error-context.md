# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-organization-plans.spec.ts >> missing University pricing shows an error instead of falling back to business plans
- Location: tests\billing-organization-plans.spec.ts:147:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#expired-plans').getByRole('alert')
Expected substring: "University plan pricing could not be loaded"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('#expired-plans').getByRole('alert') with timeout 15000ms
  - waiting for locator('#expired-plans').getByRole('alert')

```

```yaml
- img "WorkGrind"
- alert
```

```
Tearing down "context" exceeded the test timeout of 60000ms.
```