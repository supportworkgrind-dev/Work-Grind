# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: feature-access-errors.spec.ts >> a Solo owner can open Daily Focus, which the API now serves
- Location: tests\feature-access-errors.spec.ts:68:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Tearing down "context" exceeded the test timeout of 60000ms.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - img "WorkGrind" [ref=e4]:
    - generic [aria-hidden] [ref=e8]:
      - generic [ref=e9]: Work
      - generic [ref=e10]: Grind
  - button "Open Next.js Dev Tools" [ref=e21] [cursor=pointer]:
    - generic [ref=e24]:
      - text: Compiling
      - generic [ref=e25]:
        - generic [ref=e26]: .
        - generic [ref=e27]: .
        - generic [ref=e28]: .
  - alert [ref=e29]
```