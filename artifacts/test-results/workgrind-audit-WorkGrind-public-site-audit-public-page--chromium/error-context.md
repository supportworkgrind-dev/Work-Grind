# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /
- Location: tests\workgrind-audit.spec.ts:218:9

# Error details

```
Error: / audit issues

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "Button without accessible name: <button class=\"h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" str",
+   "Button without accessible name: <button class=\"text-slate-600 hover:text-slate-400 transition-colors\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejo",
+   "401 POST http://localhost:3000/api/auth/refresh",
+   "Console error: Failed to load resource: the server responded with a status of 401 (Unauthorized)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "WorkGrind home" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "WorkGrind" [ref=e6]:
            - generic [aria-hidden] [ref=e10]:
              - generic [ref=e11]: Work
              - generic [ref=e12]: Grind
        - navigation "Main navigation" [ref=e13]:
          - button "Product" [ref=e14] [cursor=pointer]
          - button "Solutions" [ref=e15] [cursor=pointer]
          - button "Features" [ref=e16] [cursor=pointer]
          - button "AI" [ref=e17] [cursor=pointer]
          - button "Security" [ref=e18] [cursor=pointer]
        - generic [ref=e19]:
          - button "Select language" [ref=e21] [cursor=pointer]:
            - generic [ref=e25]: English
          - link "Sign In" [ref=e28] [cursor=pointer]:
            - /url: /login
          - link "Get Started" [ref=e29] [cursor=pointer]:
            - /url: /signup
    - region "WorkGrind — connected workspaces for personal work, business, and education" [ref=e30]:
      - generic [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]: For individuals, business teams, and education.
          - heading "One workspace for work, business, and education." [level=1] [ref=e36]: One workspace forwork, business, andeducation.
          - paragraph [ref=e37]: Bring personal planning and freelancer work together with business team tools and academic administration for schools, colleges, and universities. Tavro AI supports both work and learning, with access based on your workspace, role, and plan.
          - generic [ref=e38]:
            - link "Get Started" [ref=e39] [cursor=pointer]:
              - /url: /signup
            - link "Explore Features" [ref=e42] [cursor=pointer]:
              - /url: /features
          - generic [ref=e45]:
            - link "Solo" [ref=e46] [cursor=pointer]:
              - /url: /signup?workspace=solo
            - link "Company" [ref=e50] [cursor=pointer]:
              - /url: /signup?workspace=business
            - link "School / Academy" [ref=e55] [cursor=pointer]:
              - /url: /signup?workspace=school
            - link "College" [ref=e61] [cursor=pointer]:
              - /url: /signup?workspace=college
            - link "University" [ref=e64] [cursor=pointer]:
              - /url: /signup?workspace=university
        - generic [ref=e69]:
          - generic [ref=e70]:
            - generic [ref=e74]:
              - generic [ref=e75]: WG
              - generic [ref=e77]: WorkGrind — Collaboration
            - generic [ref=e78]:
              - generic [ref=e79]: Search…
              - generic [ref=e87]: SC
          - generic [ref=e88]:
            - generic [ref=e89]:
              - generic [ref=e90]: Overview
              - generic [ref=e97]: CRM
              - generic [ref=e103]: Team
              - generic [ref=e110]: Chat
              - generic [ref=e114]: Tasks
              - generic [ref=e119]: Projects
              - generic [ref=e124]: Meetings
              - generic [ref=e129]: Calendar
              - generic [ref=e133]: Tavro AI
            - generic [ref=e140]:
              - generic [ref=e141]:
                - generic [ref=e145]: sales
                - generic [ref=e146]: Sales team
              - generic [ref=e147]:
                - generic [ref=e148]:
                  - generic [ref=e149]: MS
                  - generic [ref=e150]:
                    - generic [ref=e151]:
                      - generic [ref=e152]: Maria S
                      - generic [ref=e153]: just now
                    - paragraph [ref=e154]: Globex demo went great! They want a proposal by Friday.
                - generic [ref=e155]:
                  - generic [ref=e156]: DP
                  - generic [ref=e157]:
                    - generic [ref=e158]:
                      - generic [ref=e159]: David P
                      - generic [ref=e160]: just now
                    - paragraph [ref=e161]: On it — I'll prep the Globex deck now.
                - generic [ref=e162]:
                  - generic [ref=e163]: SC
                  - generic [ref=e164]:
                    - generic [ref=e165]:
                      - generic [ref=e166]: Sarah C
                      - generic [ref=e167]: just now
                    - paragraph [ref=e168]: Nice work 🎉 Tagging this to the Globex deal in CRM.
              - generic [ref=e169]: "Message #sales…"
          - generic [ref=e175]:
            - generic [ref=e176]: Collaboration
            - generic [ref=e188]: Illustrative Preview
          - group "Choose a product preview scene" [ref=e191]:
            - button "Show Overview preview" [ref=e192] [cursor=pointer]:
              - generic [ref=e198]: Overview
            - button "Show Tasks preview" [ref=e199] [cursor=pointer]:
              - generic [ref=e203]: Tasks
            - button "Show CRM preview" [ref=e204] [cursor=pointer]:
              - generic [ref=e209]: CRM
            - button "Show Team preview" [ref=e210] [cursor=pointer]:
              - generic [ref=e216]: Team
            - button "Show Collaboration preview" [pressed] [ref=e217] [cursor=pointer]:
              - generic [ref=e220]: Collaboration
            - button "Show Tavro AI preview" [ref=e221] [cursor=pointer]:
              - generic [ref=e225]: Tavro AI
          - img "Illustrative WorkGrind preview spanning personal work, business, and academic workspaces" [ref=e226]:
            - generic [ref=e228]:
              - generic [ref=e229]: Personal
              - generic [ref=e235]: Business
              - generic [ref=e242]: Classes
              - generic [ref=e247]: Academics
              - generic [ref=e253]: Tavro AI
    - region [ref=e259]:
      - generic [ref=e260]:
        - generic [ref=e261]:
          - heading "One workspace for work and learning." [level=2] [ref=e262]
          - paragraph [ref=e263]: WorkGrind brings personal work, business and office teams, and education administration together. Choose Solo, Company, School / Academy, College, or University; available features depend on workspace, role, and plan.
        - generic [ref=e264]:
          - generic [ref=e265]:
            - generic [ref=e266]: Solo
            - heading "Personal Work & Freelance" [level=3] [ref=e272]
            - list [ref=e273]:
              - listitem [ref=e274]: Daily focus & priorities
              - listitem [ref=e276]: Tasks, projects & planning
              - listitem [ref=e278]: Calendar & documents
              - listitem [ref=e280]: Tavro AI assistance where available
          - generic [ref=e282]:
            - generic [ref=e283]: Company
            - heading "Business & Office" [level=3] [ref=e291]
            - list [ref=e292]:
              - listitem [ref=e293]: Team chat & meetings
              - listitem [ref=e295]: Tasks, projects & shared work
              - listitem [ref=e297]: CRM & client portal
              - listitem [ref=e299]: Documents, files, workflows & analytics
            - generic "Sheets spreadsheet preview" [ref=e301]:
              - generic [ref=e302]: Sheets
              - generic [ref=e305]:
                - generic [ref=e307]: A
                - generic [ref=e308]: B
                - generic [ref=e309]: C
                - generic [ref=e310]: "1"
                - generic [ref=e314]: "2"
                - generic [ref=e318]: "3"
          - generic [ref=e322]:
            - generic [ref=e323]: Education
            - heading "Education Administration" [level=3] [ref=e329]
            - list [ref=e330]:
              - listitem [ref=e331]: Students, teachers & administrators
              - listitem [ref=e333]: Classes, courses & timetables
              - listitem [ref=e335]: Attendance, assignments & online class meetings where enabled
              - listitem [ref=e337]: Exams, results & fee records
          - generic [ref=e339]:
            - generic [ref=e340]: Tavro AI
            - heading "Workspace Assistance" [level=3] [ref=e346]
            - list [ref=e347]:
              - listitem [ref=e348]: Ask about accessible information
              - listitem [ref=e350]: Summarize supported records
              - listitem [ref=e352]: Use available actions
              - listitem [ref=e354]: Respect role and plan access
        - generic [ref=e356]:
          - generic [ref=e357]:
            - paragraph [ref=e358]: One connected workspace
            - paragraph [ref=e359]: Tools for personal work, teams, and learning—with access shaped by your workspace.
          - list "Personal, Company, Education, and Tavro AI workspaces" [ref=e360]:
            - listitem [ref=e361]:
              - generic [ref=e367]:
                - generic [ref=e368]: Personal
                - generic [ref=e369]: Focus & planning
            - listitem [ref=e372]:
              - generic [ref=e379]:
                - generic [ref=e380]: Company
                - generic [ref=e381]: Teams & customers
            - listitem [ref=e384]:
              - generic [ref=e389]:
                - generic [ref=e390]: Education
                - generic [ref=e391]: Academic work
            - listitem [ref=e394]:
              - generic [ref=e400]:
                - generic [ref=e401]: Tavro AI
                - generic [ref=e402]: Workspace assistance
    - region [ref=e403]:
      - generic [ref=e405]:
        - generic [ref=e406]:
          - generic [ref=e407]: CRM
          - heading "Company workspace CRM. Move every opportunity forward." [level=2] [ref=e408]: Company workspace CRM.Move every opportunity forward.
          - paragraph [ref=e409]: Keep contacts, companies, conversations, and follow-ups connected in the Company workspace. CRM is not part of School, College, or University experiences.
          - list [ref=e410]:
            - listitem [ref=e411]: Contacts & companies in one view
            - listitem [ref=e415]: Activity timeline with all interactions
            - listitem [ref=e419]: Linked tasks, meetings and notes
            - listitem [ref=e423]: Stage-by-stage pipeline tracking
        - generic [ref=e428]:
          - generic [ref=e429]:
            - generic [ref=e430]: CRM
            - generic [ref=e436]:
              - generic [ref=e437]: Search customers…
              - button [ref=e441] [cursor=pointer]
          - list "Company relationship flow" [ref=e443]:
            - listitem [ref=e444]:
              - generic [ref=e450]: Company
            - listitem [ref=e453]:
              - generic [ref=e460]: Contact
            - listitem [ref=e463]:
              - generic [ref=e468]: Deal
            - listitem [ref=e471]:
              - generic [ref=e475]: Activity
          - generic [ref=e476]:
            - generic [ref=e477]:
              - paragraph [ref=e479]: Companies · 4
              - button "AC Acme Corporation Negotiation Proposal sent · 2h" [ref=e480] [cursor=pointer]:
                - generic [ref=e481]: AC
                - generic [ref=e482]:
                  - generic [ref=e483]:
                    - generic [ref=e484]: Acme Corporation
                    - generic [ref=e485]: Negotiation
                  - paragraph [ref=e486]: Proposal sent · 2h
              - button "GI Globex Industries Qualified Follow-up due · Today" [ref=e487] [cursor=pointer]:
                - generic [ref=e488]: GI
                - generic [ref=e489]:
                  - generic [ref=e490]:
                    - generic [ref=e491]: Globex Industries
                    - generic [ref=e492]: Qualified
                  - paragraph [ref=e493]: Follow-up due · Today
              - button "IG Initech Group Won Contract signed · 1d" [ref=e494] [cursor=pointer]:
                - generic [ref=e495]: IG
                - generic [ref=e496]:
                  - generic [ref=e497]:
                    - generic [ref=e498]: Initech Group
                    - generic [ref=e499]: Won
                  - paragraph [ref=e500]: Contract signed · 1d
              - button "UC Umbrella Corp Lead Intro call · 3d" [ref=e501] [cursor=pointer]:
                - generic [ref=e502]: UC
                - generic [ref=e503]:
                  - generic [ref=e504]:
                    - generic [ref=e505]: Umbrella Corp
                    - generic [ref=e506]: Lead
                  - paragraph [ref=e507]: Intro call · 3d
            - generic [ref=e509]:
              - generic [ref=e510]:
                - generic [ref=e511]:
                  - generic [ref=e512]: AC
                  - generic [ref=e513]:
                    - paragraph [ref=e514]: Acme Corporation
                    - paragraph [ref=e515]: David Park
                - button [ref=e516] [cursor=pointer]
              - generic [ref=e521]:
                - generic [ref=e522]:
                  - paragraph [ref=e523]: Status
                  - text: Active
                - generic [ref=e524]:
                  - paragraph [ref=e525]: Deal Value
                  - paragraph [ref=e526]: $48,000
              - generic [ref=e527]:
                - paragraph [ref=e528]: Pipeline Stage
                - paragraph [ref=e539]: Negotiation
              - generic [ref=e540]:
                - paragraph [ref=e541]: Activity
                - generic [ref=e542]:
                  - generic [ref=e543]:
                    - generic [ref=e546]: Discovery call — 45 min
                    - generic [ref=e547]: 3d ago
                  - generic [ref=e548]:
                    - generic [ref=e552]: Proposal deck sent
                    - generic [ref=e553]: 2h ago
                  - generic [ref=e554]:
                    - generic [ref=e558]: Follow-up scheduled
                    - generic [ref=e559]: Tomorrow
    - generic [ref=e562]:
      - generic [ref=e564]:
        - generic [ref=e565]:
          - generic [ref=e566]: Team
          - generic [ref=e573]: 32 members · 6 departments
        - generic [ref=e574]:
          - generic [ref=e575]:
            - generic [ref=e576]:
              - generic [ref=e577]: Engineering
              - generic [ref=e580]: 12 members
            - generic [ref=e581]:
              - generic [ref=e582]:
                - generic [ref=e583]: A
                - generic [ref=e586]:
                  - generic [ref=e587]:
                    - generic [ref=e588]: Alex R.
                    - generic [ref=e589]: Lead Dev
                  - generic [ref=e590]: API optimisation
              - generic [ref=e594]:
                - generic [ref=e595]: M
                - generic [ref=e598]:
                  - generic [ref=e599]:
                    - generic [ref=e600]: Mia C.
                    - generic [ref=e601]: Frontend
                  - generic [ref=e602]: Dashboard redesign
              - generic [ref=e606]:
                - generic [ref=e607]: T
                - generic [ref=e610]:
                  - generic [ref=e611]:
                    - generic [ref=e612]: Tom L.
                    - generic [ref=e613]: DevOps
                  - generic [ref=e614]: CI pipeline fix
          - generic [ref=e618]:
            - generic [ref=e619]:
              - generic [ref=e620]: Design
              - generic [ref=e623]: 6 members
            - generic [ref=e624]:
              - generic [ref=e625]:
                - generic [ref=e626]: S
                - generic [ref=e629]:
                  - generic [ref=e630]:
                    - generic [ref=e631]: Sara J.
                    - generic [ref=e632]: Product Designer
                  - generic [ref=e633]: Onboarding flow
              - generic [ref=e637]:
                - generic [ref=e638]: J
                - generic [ref=e641]:
                  - generic [ref=e642]:
                    - generic [ref=e643]: Jake M.
                    - generic [ref=e644]: Brand
                  - generic [ref=e645]: Brand update
      - generic [ref=e649]:
        - generic [ref=e650]: Team Management
        - heading "Know your people. Align the work." [level=2] [ref=e651]: Know your people.Align the work.
        - paragraph [ref=e652]: See who is working on what, across every department. Workload visibility, roles, status and active projects — all in one place.
        - list [ref=e653]:
          - listitem [ref=e654]: Departments, roles & permissions
          - listitem [ref=e656]: Member status & activity
          - listitem [ref=e658]: Member profiles & skills
          - listitem [ref=e660]: Cross-team project visibility
    - generic [ref=e663]:
      - generic [ref=e664]:
        - heading "From conversation to completion." [level=2] [ref=e665]
        - paragraph [ref=e666]: Bring chats, tasks, projects, meetings, and follow-up together in a shared workspace.
      - generic [ref=e667]:
        - generic [ref=e673]:
          - generic [ref=e678]:
            - paragraph [ref=e679]: Step 1
            - paragraph [ref=e680]: Chat
          - generic [ref=e681]:
            - generic [ref=e682]: "#product"
            - generic [ref=e687]:
              - generic [ref=e688]: SR
              - paragraph [ref=e690]: "\"Let's finish the onboarding redesign before launch.\""
        - generic [ref=e696]:
          - generic [ref=e702]:
            - paragraph [ref=e703]: Step 2
            - paragraph [ref=e704]: Task
          - generic [ref=e705]:
            - generic [ref=e706]:
              - generic [ref=e707]: New Task
              - generic [ref=e708]: High
            - paragraph [ref=e709]: Finish onboarding redesign
            - generic [ref=e710]:
              - generic [ref=e711]: → Onboarding Project
              - generic [ref=e712]: Due Friday
        - generic [ref=e718]:
          - generic [ref=e724]:
            - paragraph [ref=e725]: Step 3
            - paragraph [ref=e726]: Meeting
          - generic [ref=e727]:
            - generic [ref=e728]:
              - generic [ref=e729]: SAMPLE
              - generic [ref=e732]: Design Review
            - generic [ref=e733]:
              - generic [ref=e734]: SR
              - generic [ref=e735]: AR
              - generic [ref=e736]: MC
        - generic [ref=e738]:
          - generic [ref=e744]:
            - paragraph [ref=e745]: Step 4
            - paragraph [ref=e746]: Tavro AI Summary
          - generic [ref=e747]:
            - generic [ref=e748]: Tavro AI Summary
            - list [ref=e753]:
              - listitem [ref=e754]: ✓ Redesign approved
              - listitem [ref=e755]: 3 tasks created
              - listitem [ref=e756]: 1 Acme demo scheduled
      - generic [ref=e757]:
        - generic [ref=e758]:
          - heading "Calendar → Meeting → Team" [level=3] [ref=e760]
          - generic [ref=e763]:
            - generic [ref=e764]:
              - paragraph [ref=e768]: Schedule
              - paragraph [ref=e769]: Design Review
            - generic [ref=e772]:
              - paragraph [ref=e777]: Meeting
              - paragraph [ref=e778]: Shared room
            - generic [ref=e781]:
              - paragraph [ref=e788]: Team
              - paragraph [ref=e789]: People together
        - generic [ref=e790]:
          - heading "Automation" [level=3] [ref=e792]
          - generic [ref=e795]:
            - generic [ref=e796]:
              - paragraph [ref=e800]: Trigger
              - paragraph [ref=e801]: CRM follow-up due
            - generic [ref=e804]:
              - paragraph [ref=e810]: Workflow
              - paragraph [ref=e811]: Create task reminder
            - generic [ref=e814]:
              - paragraph [ref=e819]: Result
              - paragraph [ref=e820]: Team stays on track
    - generic [ref=e823]:
      - generic [ref=e824]:
        - generic [ref=e825]: Tasks & Projects
        - heading "Know what needs to happen next." [level=2] [ref=e826]
        - paragraph [ref=e827]: Organize tasks, priorities, assignments, and due dates, then follow project status and progress. Milestone and Gantt timeline planning is coming soon.
        - list [ref=e828]:
          - listitem [ref=e829]: Task board and list views
          - listitem [ref=e833]: Project status and progress
          - listitem [ref=e837]: Priority, assignee and due dates
          - listitem [ref=e841]: Related work with CRM and meetings
      - generic [ref=e846]:
        - generic [ref=e847]:
          - generic [ref=e848]: Onboarding Project
          - generic [ref=e853]:
            - generic [ref=e854]: 8 tasks
            - generic [ref=e857]: 62%
        - 'generic "Task pipeline: To Do, In Progress, Review, Done" [ref=e858]':
          - generic [ref=e860]: To Do
          - generic [ref=e863]: In Progress
          - generic [ref=e866]: Review
          - generic [ref=e869]: Done
        - generic [ref=e873]:
          - generic [ref=e874]:
            - generic [ref=e875]:
              - generic [ref=e877]: To Do
              - generic [ref=e878]: "2"
            - generic [ref=e879]:
              - generic [ref=e880]:
                - paragraph [ref=e881]: Write Q4 proposal
                - text: High
              - generic [ref=e882]:
                - paragraph [ref=e883]: Update docs
                - text: Normal
          - generic [ref=e884]:
            - generic [ref=e885]:
              - generic [ref=e887]: In Progress
              - generic [ref=e888]: "2"
            - generic [ref=e889]:
              - generic [ref=e890]:
                - paragraph [ref=e891]: Onboarding redesign
                - text: High
              - generic [ref=e892]:
                - paragraph [ref=e893]: API review
                - text: Normal
          - generic [ref=e894]:
            - generic [ref=e895]:
              - generic [ref=e897]: Review
              - generic [ref=e898]: "1"
            - generic [ref=e900]:
              - paragraph [ref=e901]: Acme demo deck
              - text: Urgent
          - generic [ref=e902]:
            - generic [ref=e903]:
              - generic [ref=e905]: Done
              - generic [ref=e906]: "1"
            - generic [ref=e908]:
              - paragraph [ref=e909]: Contract signed
              - text: High
    - region [ref=e910]:
      - generic [ref=e912]:
        - group "Tavro AI turns a user request into workspace actions" [ref=e914]:
          - generic [ref=e915]:
            - generic [ref=e916]: Workspace assistance
            - generic [ref=e917]: Context connected
          - generic [ref=e919]:
            - generic [ref=e920]:
              - generic [ref=e921]: You
              - paragraph [ref=e924]: Summarize information I can access.
            - generic [ref=e927]:
              - generic [ref=e928]: Tavro AI
              - paragraph [ref=e932]: Works with supported information available to your account.
            - generic [ref=e935]:
              - generic [ref=e936]: Actions & results
              - paragraph [ref=e940]: Summaries use supported workspace information your role can access.
        - generic [ref=e941]:
          - generic [ref=e942]: Tavro AI for work and learning
          - heading "Support for work and learning. Meet Tavro AI." [level=2] [ref=e947]:
            - text: Support for work and learning.
            - generic [ref=e948]: Meet Tavro AI.
          - paragraph [ref=e949]: Tavro AI can help with supported business, personal, and academic workspace information—from organizing work to learning support. Available information and actions depend on your workspace, role, and plan.
          - link "Try Tavro AI" [ref=e950] [cursor=pointer]:
            - /url: /ai
    - region [ref=e953]:
      - generic [ref=e955]:
        - generic [ref=e956]:
          - generic [ref=e957]: Security
          - heading "Built for work and learning." [level=2] [ref=e961]
          - paragraph [ref=e962]: WorkGrind applies authentication and workspace permissions to supported areas. Available controls vary by feature and account.
          - img "Illustration of account authentication, workspace permissions, and recorded activity where available" [ref=e963]:
            - generic [ref=e964]: Protected workspace data flow
            - generic [ref=e967]:
              - generic [ref=e968]:
                - paragraph [ref=e975]: Role access
                - paragraph [ref=e976]: Feature permissions
              - generic [ref=e978]:
                - paragraph [ref=e983]: Workspace
                - paragraph [ref=e984]: Tenant scoping
              - generic [ref=e986]:
                - paragraph [ref=e991]: Activity
                - paragraph [ref=e992]: Where available
        - generic [ref=e993]:
          - generic [ref=e994]:
            - heading "Role-Based Access" [level=3] [ref=e1001]
            - paragraph [ref=e1002]: Workspace membership and role permissions govern access to supported features.
          - generic [ref=e1003]:
            - heading "Workspace Scoping" [level=3] [ref=e1007]
            - paragraph [ref=e1008]: Workspace context is used to scope access to tenant data.
          - generic [ref=e1009]:
            - heading "Authentication" [level=3] [ref=e1014]
            - paragraph [ref=e1015]: WorkGrind uses account authentication and session controls.
          - generic [ref=e1016]:
            - heading "Activity Records" [level=3] [ref=e1021]
            - paragraph [ref=e1022]: Some privileged actions are recorded where audit logging is available.
    - region "Get started with WorkGrind" [ref=e1023]:
      - generic [ref=e1025]:
        - generic [ref=e1026]: Choose your WorkGrind workspace
        - heading "Your workspace for work and learning." [level=2] [ref=e1029]:
          - text: Your workspace for
          - generic [ref=e1030]: work and learning.
        - paragraph [ref=e1031]: Find the right tools for personal productivity, company collaboration, or academic administration.
        - generic [ref=e1032]:
          - link "Get Started" [ref=e1033] [cursor=pointer]:
            - /url: /signup
          - button "Explore Features" [ref=e1036] [cursor=pointer]
        - img "Illustration of WorkGrind capabilities for personal, business, and academic workspaces" [ref=e1037]:
          - generic [ref=e1038]:
            - generic [ref=e1040]: Personal
            - generic [ref=e1046]: Company
            - generic [ref=e1053]: Classes
            - generic [ref=e1058]: Faculty
            - generic [ref=e1064]: Tavro AI
        - generic [ref=e1070]:
          - generic [ref=e1071]: Solo
          - generic [ref=e1073]: Company
          - generic [ref=e1075]: School / Academy
          - generic [ref=e1077]: College / University
    - contentinfo [ref=e1079]:
      - generic [ref=e1080]:
        - generic [ref=e1081]:
          - generic [ref=e1082]:
            - img "WorkGrind" [ref=e1083]:
              - generic [aria-hidden] [ref=e1087]:
                - generic [ref=e1088]: Work
                - generic [ref=e1089]: Grind
            - paragraph [ref=e1090]: A connected workspace for personal work, business, and education.
            - link "Follow WorkGrind on Instagram" [ref=e1092] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
            - paragraph [ref=e1097]: © 2026 WorkGrind. All rights reserved.
          - generic [ref=e1098]:
            - heading "Company" [level=3] [ref=e1099]
            - list [ref=e1100]:
              - listitem [ref=e1101]:
                - link "About" [ref=e1102] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e1103]:
                - link "Features" [ref=e1104] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e1105]:
                - link "Demo" [ref=e1106] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=e1107]:
                - link "Contact" [ref=e1108] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e1109]:
            - heading "Legal" [level=3] [ref=e1110]
            - list [ref=e1111]:
              - listitem [ref=e1112]:
                - link "Privacy Policy" [ref=e1113] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e1114]:
                - link "Terms of Service" [ref=e1115] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e1116]:
                - link "Cookie Preferences" [ref=e1117] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e1118]:
                - link "Refund Policy" [ref=e1119] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=e1120]:
                - link "Cancellation Policy" [ref=e1121] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=e1122]:
                - link "Disclaimer" [ref=e1123] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=e1124]:
            - heading "Trust & Security" [level=3] [ref=e1125]
            - list [ref=e1126]:
              - listitem [ref=e1127]:
                - link "Security" [ref=e1128] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e1129]:
                - link "Responsible Disclosure" [ref=e1130] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=e1131]:
                - link "Accessibility" [ref=e1132] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=e1133]:
                - link "Data Processing Agreement" [ref=e1134] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=e1135]:
                - link "Acceptable Use" [ref=e1136] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e1137]:
                - link "Community Guidelines" [ref=e1138] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=e1139]:
            - heading "Support" [level=3] [ref=e1140]
            - list [ref=e1141]:
              - listitem [ref=e1142]:
                - link "Help Center" [ref=e1143] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=e1144]:
                - link "Support" [ref=e1145] [cursor=pointer]:
                  - /url: /support
        - generic [ref=e1146]:
          - paragraph [ref=e1147]: Choose a Solo, Company, School, College, or University workspace.
          - button "Select language" [ref=e1149] [cursor=pointer]:
            - generic [ref=e1153]: English
  - alert [ref=e1156]
```

# Test source

```ts
  158 |       .filter((src) => {
  159 |         try {
  160 |           return new URL(src).origin === location.origin;
  161 |         } catch {
  162 |           return false;
  163 |         }
  164 |       }))]
  165 |   );
  166 |   const secretMarkers: string[] = [];
  167 |   for (const src of scripts) {
  168 |     try {
  169 |       const scriptResponse = await page.request.get(src, { timeout: 10_000 });
  170 |       const scriptText = await scriptResponse.text();
  171 |       const marker = scriptText.match(
  172 |         /(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|mongodb(?:\+srv)?:\/\/[^\s"'<>]{10,})/
  173 |       );
  174 |       if (marker) secretMarkers.push(`${safeUrl(src)} (${marker[0].startsWith('mongodb') ? 'database URI' : 'key/token marker'})`);
  175 |     } catch {
  176 |       // The browser network audit records failed resource requests separately.
  177 |     }
  178 |   }
  179 |   const unlabeledButtons = await page.locator('button').evaluateAll((buttons) =>
  180 |     buttons
  181 |       .filter((button) => {
  182 |         const hasName =
  183 |           button.textContent?.trim() ||
  184 |           button.getAttribute('aria-label') ||
  185 |           button.getAttribute('title') ||
  186 |           button.querySelector('img[alt], svg[aria-label], [aria-labelledby]');
  187 |         return !hasName;
  188 |       })
  189 |       .map((button) => button.outerHTML.slice(0, 240))
  190 |   );
  191 |   const oldBrandMatches = pageText
  192 |     .split(/\r?\n/)
  193 |     .map((line) => line.trim())
  194 |     .filter((line) => oldBrandPattern.test(line))
  195 |     .map((line) => safeText(line).slice(0, 240));
  196 | 
  197 |   return {
  198 |     response,
  199 |     elapsedMs,
  200 |     status: response?.status() ?? null,
  201 |     securityHeaders: response ? await response.allHeaders() : {},
  202 |     title,
  203 |     pageText,
  204 |     imageFailures,
  205 |     overflow,
  206 |     emptyLinks,
  207 |     brokenInternalLinks,
  208 |     secretMarkers,
  209 |     unlabeledButtons,
  210 |     oldBrandMatches,
  211 |     runtimeIssues: runtime.issues,
  212 |     stopTracking: runtime.stop,
  213 |   };
  214 | }
  215 | 
  216 | test.describe('WorkGrind public-site audit', () => {
  217 |   for (const path of publicPaths) {
  218 |     test(`public page ${path}`, async ({ page }) => {
  219 |       const audit = await inspectPage(page, path);
  220 |       expect(audit.response, `${path} navigation returned no HTTP response`).not.toBeNull();
  221 |       expect(audit.response!.status(), `${path} navigation status`).toBeLessThan(400);
  222 |       expect(audit.title, `${path} should have a document title`).toBeTruthy();
  223 |       expect(audit.pageText.trim().length, `${path} should render visible content`).toBeGreaterThan(20);
  224 |       const issues = [
  225 |         ...audit.imageFailures.map((item) => `Broken image: ${item}`),
  226 |         ...(audit.overflow.scrollWidth > audit.overflow.clientWidth + 2
  227 |           ? [`Horizontal overflow: ${audit.overflow.scrollWidth}px content / ${audit.overflow.clientWidth}px viewport`]
  228 |           : []),
  229 |         ...audit.emptyLinks.map((item) => `Link without destination: ${item}`),
  230 |         ...audit.brokenInternalLinks.map((item) => `Broken internal link: ${item}`),
  231 |         ...audit.secretMarkers.map((item) => `Potential secret exposed in client bundle: ${item}`),
  232 |         ...audit.unlabeledButtons.map((item) => `Button without accessible name: ${safeText(item)}`),
  233 |         ...audit.oldBrandMatches.map((item) => `Old-brand text: ${item}`),
  234 |         ...audit.runtimeIssues,
  235 |       ];
  236 |       await test.info().attach('page-audit.json', {
  237 |         body: JSON.stringify({
  238 |           url: safeUrl(page.url()),
  239 |           path,
  240 |           status: audit.status,
  241 |           contentSecurityPolicy: Boolean(audit.securityHeaders['content-security-policy']),
  242 |           strictTransportSecurity: Boolean(audit.securityHeaders['strict-transport-security']),
  243 |           setCookieAttributes: (audit.securityHeaders['set-cookie'] || '')
  244 |             .split(/,(?=[^;]+=[^;]+)/)
  245 |             .filter(Boolean)
  246 |             .map((cookie) => ({
  247 |               secure: /;\s*secure\b/i.test(cookie),
  248 |               httpOnly: /;\s*httponly\b/i.test(cookie),
  249 |               sameSite: cookie.match(/;\s*samesite=([^;]+)/i)?.[1] || null,
  250 |             })),
  251 |           title: safeText(audit.title),
  252 |           elapsedMs: audit.elapsedMs,
  253 |           issues,
  254 |           oldBrandMatches: audit.oldBrandMatches,
  255 |         }, null, 2),
  256 |         contentType: 'application/json',
  257 |       });
> 258 |       expect(issues, `${path} audit issues`).toEqual([]);
      |                                              ^ Error: / audit issues
  259 |       test.info().annotations.push({ type: 'navigation-ms', description: String(audit.elapsedMs) });
  260 |       audit.stopTracking();
  261 |     });
  262 |   }
  263 | });
  264 | 
  265 | test('responsive layouts on key public pages', async ({ page }) => {
  266 |   const issues: string[] = [];
  267 |   for (const viewport of [
  268 |     { name: 'desktop', width: 1440, height: 900 },
  269 |     { name: 'laptop', width: 1280, height: 720 },
  270 |     { name: 'tablet', width: 768, height: 1024 },
  271 |     { name: 'mobile', width: 390, height: 844 },
  272 |   ]) {
  273 |     await page.setViewportSize({ width: viewport.width, height: viewport.height });
  274 |     for (const path of ['/', '/pricing', '/signup', '/login']) {
  275 |       try {
  276 |         await page.goto(path, { waitUntil: 'domcontentloaded' });
  277 |         const sizes = await page.evaluate(() => ({
  278 |           body: document.body.scrollWidth,
  279 |           viewport: document.documentElement.clientWidth,
  280 |         }));
  281 |         if (sizes.body > sizes.viewport + 2) {
  282 |           issues.push(`${viewport.name} ${path}: ${sizes.body}px content exceeds ${sizes.viewport}px viewport`);
  283 |         }
  284 |       } catch (error) {
  285 |         issues.push(`${viewport.name} ${path}: ${error instanceof Error ? error.message : 'navigation failed'}`);
  286 |       }
  287 |     }
  288 |   }
  289 |   await test.info().attach('responsive-audit.json', {
  290 |     body: JSON.stringify({ issues }, null, 2),
  291 |     contentType: 'application/json',
  292 |   });
  293 |   expect(issues).toEqual([]);
  294 | });
  295 | 
  296 | test('login form exposes required email/password fields and blocks empty submission', async ({ page }) => {
  297 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  298 |   const email = page.locator('input[type="email"]');
  299 |   const password = page.locator('input[type="password"]');
  300 |   await expect(email).toHaveCount(1);
  301 |   await expect(password).toHaveCount(1);
  302 |   await expect(page.locator('button[type="submit"]')).toHaveCount(1);
  303 |   expect(await email.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  304 |   expect(await password.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  305 |   await page.locator('button[type="submit"]').click();
  306 |   expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  307 |   expect(new URL(page.url()).pathname).toBe('/login');
  308 | });
  309 | 
  310 | test('protected application routes redirect unauthenticated visitors', async ({ page }) => {
  311 |   const results: Array<{ path: string; status: number | null; landedAt: string }> = [];
  312 |   const issues: string[] = [];
  313 |   for (const path of authenticatedPaths) {
  314 |     try {
  315 |       const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  316 |       await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  317 |       const landedAt = new URL(page.url()).pathname;
  318 |       results.push({ path, status: response?.status() ?? null, landedAt });
  319 |       if (!/\/login\/?$/.test(landedAt)) issues.push(`${path} resolved to ${landedAt}, not login`);
  320 |     } catch (error) {
  321 |       issues.push(`${path}: ${error instanceof Error ? safeText(error.message) : 'navigation failed'}`);
  322 |       results.push({ path, status: null, landedAt: safeUrl(page.url()) });
  323 |     }
  324 |   }
  325 |   await test.info().attach('protected-route-audit.json', {
  326 |     body: JSON.stringify({ results, issues }, null, 2),
  327 |     contentType: 'application/json',
  328 |   });
  329 |   expect(issues).toEqual([]);
  330 | });
  331 | 
  332 | test('authenticated routes and read-only feature audit', async ({ page }) => {
  333 |   const email = process.env.WORKGRIND_TEST_EMAIL;
  334 |   const password = process.env.WORKGRIND_TEST_PASSWORD;
  335 |   test.skip(!email || !password, 'Set WORKGRIND_TEST_EMAIL and WORKGRIND_TEST_PASSWORD in the environment to run authenticated checks.');
  336 | 
  337 |   const loginRuntime = trackRuntime(page);
  338 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  339 |   await page.locator('input[type="email"]').fill(email!);
  340 |   await page.locator('input[type="password"]').fill(password!);
  341 |   await page.locator('button[type="submit"]').click();
  342 |   await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });
  343 | 
  344 |   const storageState = await page.evaluate(() =>
  345 |     Object.keys(localStorage).map((name) => name.toLowerCase())
  346 |   );
  347 |   const cookies = await page.context().cookies();
  348 |   const authEvidence = {
  349 |     redirectedTo: safeUrl(page.url()),
  350 |     storageKeyNames: storageState.filter((name) => /auth|token|session/.test(name)),
  351 |     cookies: cookies
  352 |       .filter((cookie) => /auth|token|session/i.test(cookie.name))
  353 |       .map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite })),
  354 |   };
  355 |   test.info().annotations.push({
  356 |     type: 'session-evidence',
  357 |     description: JSON.stringify(authEvidence),
  358 |   });
```