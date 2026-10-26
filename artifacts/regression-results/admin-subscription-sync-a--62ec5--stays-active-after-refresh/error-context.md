# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-subscription-sync.spec.ts >> a member whose workspace is granted access leaves the expired screen without reloading and stays active after refresh
- Location: tests\admin-subscription-sync.spec.ts:159:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/subscription-expired/
Received string:  "http://127.0.0.1:3101/tasks"
Timeout: 15000ms

Call log:
  - Expect "toHaveURL" with timeout 15000ms
    7 × locator resolved to <html lang="en" dir="ltr" data-theme="original" class="plus_jakarta_sans_f1fa6da1-module__6F21nW__variable noto_naskh_arabic_b7b663af-module__X9aVuG__variable">…</html>
      - unexpected value "http://127.0.0.1:3101/tasks"

```

```yaml
- alert
```

```
Tearing down "context" exceeded the test timeout of 60000ms.
```