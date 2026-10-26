# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-organization-plans.spec.ts >> expired business workspace still shows Starter and Pro only
- Location: tests\billing-organization-plans.spec.ts:138:5

# Error details

```
Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - main [ref=e12]:
    - generic [ref=e13]:
      - link "WorkGrind billing" [ref=e14] [cursor=pointer]:
        - /url: /billing
        - img "WorkGrind" [ref=e15]:
          - generic [aria-hidden] [ref=e19]:
            - generic [ref=e20]: Work
            - generic [ref=e21]: Grind
      - generic [ref=e22]:
        - paragraph [ref=e27]: Workspace access
        - heading "Your WorkGrind subscription has ended" [level=1] [ref=e28]
        - paragraph [ref=e29]: Your workspace data is safe. Renew your subscription to continue using WorkGrind.
        - generic [ref=e30]:
          - link "Renew subscription" [ref=e31] [cursor=pointer]:
            - /url: "#expired-plans"
          - link "View billing" [ref=e34] [cursor=pointer]:
            - /url: /billing#expired-plans
        - generic [ref=e35]:
          - paragraph [ref=e36]: testinguni
          - generic [ref=e37]:
            - generic [ref=e38]:
              - term [ref=e39]: Plan
              - definition [ref=e40]: Starter
            - generic [ref=e41]:
              - term [ref=e42]: Status
              - definition [ref=e43]: Expired
            - generic [ref=e45]:
              - term [ref=e46]: Price
              - definition [ref=e47]: No paid subscription
            - generic [ref=e48]:
              - term [ref=e49]: End date
              - definition [ref=e50]: —
      - region [ref=e51]:
        - generic [ref=e52]:
          - heading "Choose a plan to restore your workspace" [level=2] [ref=e53]
          - paragraph [ref=e54]: Your data is ready when you are.
        - generic [ref=e55]:
          - article [ref=e56]:
            - generic [ref=e58]:
              - paragraph [ref=e59]: Starter
              - paragraph [ref=e60]: $9/mo
            - paragraph [ref=e61]: Business plan
            - list [ref=e62]:
              - listitem [ref=e63]: Tasks & Projects
            - button "Choose Starter" [ref=e67] [cursor=pointer]
          - article [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]:
                - paragraph [ref=e71]: Pro
                - paragraph [ref=e72]: $19/mo
              - generic [ref=e73]: Most Popular
            - paragraph [ref=e74]: Business plan
            - list [ref=e75]:
              - listitem [ref=e76]: Tasks & Projects
            - button "Choose Pro" [ref=e80] [cursor=pointer]
```