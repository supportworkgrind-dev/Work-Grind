# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> protected application routes redirect unauthenticated visitors
- Location: tests\workgrind-audit.spec.ts:310:5

# Error details

```
Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=f23e1]:
  - alert [ref=f23e2]: Good to have you back.
  - main [ref=f23e3]:
    - complementary "WorkGrind workspace preview" [ref=f23e4]:
      - generic [ref=f23e5]:
        - img "WorkGrind" [ref=f23e6]:
          - generic [aria-hidden] [ref=f23e10]:
            - generic [ref=f23e11]: Work
            - generic [ref=f23e12]: Grind
        - generic [ref=f23e13]: WORK, IN GOOD ORDER.
      - generic [ref=f23e14]:
        - paragraph [ref=f23e15]: FOR WORK, BUSINESS, AND LEARNING
        - heading "One workspace for work and learning." [level=2] [ref=f23e16]: One workspacefor work and learning.
        - paragraph [ref=f23e17]: Personal planning, team collaboration, and academic administration, with Tavro AI for work and learning where available.
      - generic "Illustration of a WorkGrind workspace" [ref=f23e18]:
        - generic [ref=f23e19]:
          - generic [ref=f23e20]: MONDAY / OVERVIEW
          - generic [ref=f23e21]: SAMPLE
        - generic [ref=f23e23]: Good morning, team.
        - generic [ref=f23e25]:
          - generic [ref=f23e29]:
            - strong [ref=f23e30]: Launch planning
            - generic [ref=f23e31]: Product / Due today
          - generic [ref=f23e32]: AM
        - generic [ref=f23e33]:
          - generic [ref=f23e37]:
            - strong [ref=f23e38]: Review Q3 pipeline
            - generic [ref=f23e39]: Sales / In progress
          - generic [ref=f23e40]: JL
        - generic [ref=f23e41]:
          - generic [ref=f23e42]: FOCUS BLOCK
          - strong [ref=f23e46]: 2h 40m
      - paragraph [ref=f23e50]: For individuals, organizations, and education teams.
    - generic [ref=f23e51]:
      - generic [ref=f23e52]:
        - paragraph [ref=f23e53]: YOUR WORKSPACE AWAITS
        - heading "Good to have you back." [level=1] [ref=f23e54]
        - paragraph [ref=f23e55]: Sign in to continue in your WorkGrind workspace.
        - generic [ref=f23e57]:
          - button "Continue with Google" [ref=f23e58] [cursor=pointer]
          - button "Continue with LinkedIn" [ref=f23e64] [cursor=pointer]
        - generic [ref=f23e67]: or sign in with email
        - generic [ref=f23e70]:
          - generic [ref=f23e71]:
            - generic [ref=f23e72]: Email address
            - textbox "Email address" [ref=f23e74]:
              - /placeholder: you@example.com
          - generic [ref=f23e75]:
            - generic [ref=f23e76]:
              - generic [ref=f23e77]: Password
              - link "Forgot password?" [ref=f23e78] [cursor=pointer]:
                - /url: /forgot-password
            - generic [ref=f23e79]:
              - textbox "Password" [ref=f23e80]:
                - /placeholder: Your password
              - button "Show password" [ref=f23e81] [cursor=pointer]
          - button "Sign in to WorkGrind" [ref=f23e85] [cursor=pointer]
        - generic [ref=f23e88]:
          - paragraph [ref=f23e89]: Demo access
          - generic [ref=f23e90]:
            - button "Sarah · Owner" [ref=f23e91] [cursor=pointer]
            - button "Alex · Admin" [ref=f23e92] [cursor=pointer]
        - paragraph [ref=f23e93]:
          - text: New to WorkGrind?
          - link "Choose a workspace and get started" [ref=f23e94] [cursor=pointer]:
            - /url: /signup
        - paragraph [ref=f23e95]: Protected sign-in · Workspace access is role-based
      - generic [ref=f23e96]:
        - generic [ref=f23e97]: © 2026 WorkGrind
        - generic [ref=f23e98]: For individuals, businesses, and education teams.
```