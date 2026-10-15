# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: signup-flow.spec.ts >> Solo / Individual signup keeps its selection and gates account details
- Location: tests\signup-flow.spec.ts:13:7

# Error details

```
Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - complementary "WorkGrind workspace preview" [ref=e3]:
      - generic [ref=e4]:
        - img "WorkGrind" [ref=e5]:
          - generic [aria-hidden] [ref=e9]:
            - generic [ref=e10]: Work
            - generic [ref=e11]: Grind
        - generic [ref=e12]: WORK, IN GOOD ORDER.
      - generic [ref=e13]:
        - paragraph [ref=e14]: FOR WORK, BUSINESS, AND LEARNING
        - heading "One workspace for work and learning." [level=2] [ref=e15]: One workspacefor work and learning.
        - paragraph [ref=e16]: Personal planning, team collaboration, and academic administration, with Tavro AI for work and learning where available.
      - generic "Illustration of a WorkGrind workspace" [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: MONDAY / OVERVIEW
          - generic [ref=e20]: SAMPLE
        - generic [ref=e22]: Good morning, team.
        - generic [ref=e24]:
          - generic [ref=e28]:
            - strong [ref=e29]: Launch planning
            - generic [ref=e30]: Product / Due today
          - generic [ref=e31]: AM
        - generic [ref=e32]:
          - generic [ref=e36]:
            - strong [ref=e37]: Review Q3 pipeline
            - generic [ref=e38]: Sales / In progress
          - generic [ref=e39]: JL
        - generic [ref=e40]:
          - generic [ref=e41]: FOCUS BLOCK
          - strong [ref=e45]: 2h 40m
      - paragraph [ref=e49]: For individuals, organizations, and education teams.
    - generic [ref=e50]:
      - generic [ref=e51]:
        - list "Signup progress" [ref=e52]:
          - listitem [ref=e53]: 01 ACCOUNT TYPE
          - listitem [ref=e55]: 02 DETAILS
        - heading "Choose your workspace." [level=1] [ref=e56]
        - paragraph [ref=e57]: WorkGrind brings individual work, business teams, and education into one workspace. Tavro AI can assist with productivity and learning where available.
        - group "What are you setting up?" [ref=e58]:
          - generic [ref=e60]:
            - generic [ref=e61] [cursor=pointer]:
              - radio "Solo / Individual Plan personal work, projects, and documents. Tavro AI assistance is available where supported." [ref=e62]
              - generic [ref=e67]:
                - generic [ref=e68]: Solo / Individual
                - generic [ref=e69]: Plan personal work, projects, and documents. Tavro AI assistance is available where supported.
            - generic [ref=e71] [cursor=pointer]:
              - radio "Company / Business Coordinate office teams across chat, meetings, tasks, projects, CRM, client portal, files, workflows, and analytics." [ref=e72]
              - generic [ref=e78]:
                - generic [ref=e79]: Company / Business
                - generic [ref=e80]: Coordinate office teams across chat, meetings, tasks, projects, CRM, client portal, files, workflows, and analytics.
            - generic [ref=e82] [cursor=pointer]:
              - radio "School / Academy Manage classes, timetables, attendance, assignments, communication, online classes, exams, results, and fee records." [ref=e83]
              - generic [ref=e90]:
                - generic [ref=e91]: School / Academy
                - generic [ref=e92]: Manage classes, timetables, attendance, assignments, communication, online classes, exams, results, and fee records.
            - generic [ref=e94] [cursor=pointer]:
              - radio "College Coordinate courses, departments, schedules, attendance, assignments, communication, assessments, results, and fee records." [ref=e95]
              - generic [ref=e100]:
                - generic [ref=e101]: College
                - generic [ref=e102]: Coordinate courses, departments, schedules, attendance, assignments, communication, assessments, results, and fee records.
            - generic [ref=e104] [cursor=pointer]:
              - radio "University Support faculty, students, and administrators with departments, courses, schedules, attendance, communication, exams, and results." [ref=e105]
              - generic [ref=e109]:
                - generic [ref=e110]: University
                - generic [ref=e111]: Support faculty, students, and administrators with departments, courses, schedules, attendance, communication, exams, and results.
        - button "Continue" [disabled] [ref=e113]
        - paragraph [ref=e116]:
          - text: Already have an account?
          - link "Sign in" [ref=e117] [cursor=pointer]:
            - /url: /login
        - paragraph [ref=e118]: By continuing, you agree to WorkGrind’s terms and privacy policy.
      - generic [ref=e119]:
        - generic [ref=e120]: © 2026 WorkGrind
        - generic [ref=e121]: For individuals, businesses, and education teams.
  - button "Open Next.js Dev Tools" [ref=e127] [cursor=pointer]
  - alert [ref=e131]
```