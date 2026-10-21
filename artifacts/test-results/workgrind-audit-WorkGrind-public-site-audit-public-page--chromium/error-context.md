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
+ Received  + 4

- Array []
+ Array [
+   "401 POST https://workgrind.vercel.app/api/auth/refresh",
+   "Console error: Failed to load resource: the server responded with a status of 401 ()",
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
          - button "English , select language" [ref=e21] [cursor=pointer]:
            - generic [ref=e25]: English
            - generic [ref=e26]: ", select language"
          - link "Sign In" [ref=e29] [cursor=pointer]:
            - /url: /login
          - link "Get Started" [ref=e30] [cursor=pointer]:
            - /url: /signup
    - region "WorkGrind — connected workspaces for personal work, business, and education" [ref=e31]:
      - generic [ref=e33]:
        - generic [ref=e34]:
          - generic [ref=e35]: For individuals, business teams, and education.
          - heading "One workspace for work, business, and education." [level=1] [ref=e37]: One workspace forwork, business, andeducation.
          - paragraph [ref=e38]: Bring personal planning and freelancer work together with business team tools and academic administration for schools, colleges, and universities. Tavro AI supports both work and learning, with access based on your workspace, role, and plan.
          - generic [ref=e39]:
            - link "Get Started" [ref=e40] [cursor=pointer]:
              - /url: /signup
            - link "Explore Features" [ref=e43] [cursor=pointer]:
              - /url: /features
          - generic [ref=e46]:
            - link "Solo" [ref=e47] [cursor=pointer]:
              - /url: /signup?workspace=solo
            - link "Company" [ref=e51] [cursor=pointer]:
              - /url: /signup?workspace=business
            - link "School / Academy" [ref=e56] [cursor=pointer]:
              - /url: /signup?workspace=school
            - link "College" [ref=e62] [cursor=pointer]:
              - /url: /signup?workspace=college
            - link "University" [ref=e65] [cursor=pointer]:
              - /url: /signup?workspace=university
        - generic [ref=e70]:
          - generic [ref=e71]:
            - generic [ref=e75]:
              - generic [ref=e76]: WG
              - generic [ref=e78]: WorkGrind — Overview
            - generic [ref=e79]:
              - generic [ref=e80]: Search…
              - generic [ref=e88]: SC
          - generic [ref=e89]:
            - generic [ref=e90]:
              - generic [ref=e91]: Overview
              - generic [ref=e98]: CRM
              - generic [ref=e104]: Team
              - generic [ref=e111]: Chat
              - generic [ref=e115]: Tasks
              - generic [ref=e120]: Projects
              - generic [ref=e125]: Meetings
              - generic [ref=e130]: Calendar
              - generic [ref=e134]: Tavro AI
            - generic [ref=e141]:
              - generic [ref=e142]:
                - paragraph [ref=e143]: Overview
                - paragraph [ref=e144]: Good morning, Sarah Chen ☀️
              - generic [ref=e145]:
                - generic [ref=e146]:
                  - paragraph [ref=e147]: Open Tasks
                  - text: "12"
                  - paragraph [ref=e148]: +2 today
                - generic [ref=e149]:
                  - paragraph [ref=e150]: Active Projects
                  - text: "4"
                  - paragraph [ref=e151]: 2 on track
                - generic [ref=e152]:
                  - paragraph [ref=e153]: Meetings Today
                  - text: "3"
                  - paragraph [ref=e154]: 1 in 45m
              - generic [ref=e155]:
                - paragraph [ref=e156]: My Tasks
                - generic [ref=e157]:
                  - generic [ref=e158]:
                    - generic [ref=e160]: Review Acme proposal
                    - generic [ref=e161]: Urgent
                  - generic [ref=e162]:
                    - generic [ref=e164]: Update onboarding docs
                    - generic [ref=e165]: High
                  - generic [ref=e166]:
                    - generic [ref=e168]: Q4 planning session
                    - generic [ref=e169]: Normal
              - generic [ref=e170]:
                - paragraph [ref=e171]: Today's Meetings
                - generic [ref=e172]:
                  - generic [ref=e173]:
                    - generic [ref=e174]: 2:00 PM
                    - paragraph [ref=e179]: Acme Demo Call
                    - paragraph [ref=e180]: 4 people
                  - generic [ref=e181]:
                    - generic [ref=e182]: 4:30 PM
                    - paragraph [ref=e187]: Sprint Review
                    - paragraph [ref=e188]: 6 people
          - generic [ref=e189]:
            - generic [ref=e190]: Overview
            - generic [ref=e205]: Illustrative Preview
          - group "Choose a product preview scene" [ref=e208]:
            - button "Show Overview preview" [pressed] [ref=e209] [cursor=pointer]:
              - generic [ref=e215]: Overview
            - button "Show Tasks preview" [ref=e216] [cursor=pointer]:
              - generic [ref=e220]: Tasks
            - button "Show CRM preview" [ref=e221] [cursor=pointer]:
              - generic [ref=e226]: CRM
            - button "Show Team preview" [ref=e227] [cursor=pointer]:
              - generic [ref=e233]: Team
            - button "Show Collaboration preview" [ref=e234] [cursor=pointer]:
              - generic [ref=e237]: Collaboration
            - button "Show Tavro AI preview" [ref=e238] [cursor=pointer]:
              - generic [ref=e242]: Tavro AI
          - img "Illustrative WorkGrind preview spanning personal work, business, and academic workspaces" [ref=e243]:
            - generic [ref=e245]:
              - generic [ref=e246]: Personal
              - generic [ref=e252]: Business
              - generic [ref=e259]: Classes
              - generic [ref=e264]: Academics
              - generic [ref=e270]: Tavro AI
    - region [ref=e276]:
      - generic [ref=e277]:
        - generic [ref=e278]:
          - heading "One workspace for work and learning." [level=2] [ref=e279]
          - paragraph [ref=e280]: WorkGrind brings personal work, business and office teams, and education administration together. Choose Solo, Company, School / Academy, College, or University; available features depend on workspace, role, and plan.
        - generic [ref=e281]:
          - generic [ref=e282]:
            - generic [ref=e283]: Solo
            - heading "Personal Work & Freelance" [level=3] [ref=e289]
            - list [ref=e290]:
              - listitem [ref=e291]: Daily focus & priorities
              - listitem [ref=e293]: Tasks, projects & planning
              - listitem [ref=e295]: Calendar & documents
              - listitem [ref=e297]: Tavro AI assistance where available
          - generic [ref=e299]:
            - generic [ref=e300]: Company
            - heading "Business & Office" [level=3] [ref=e308]
            - list [ref=e309]:
              - listitem [ref=e310]: Team chat & meetings
              - listitem [ref=e312]: Tasks, projects & shared work
              - listitem [ref=e314]: CRM & client portal
              - listitem [ref=e316]: Documents, files, workflows & analytics
            - generic "Sheets spreadsheet preview" [ref=e318]:
              - generic [ref=e319]: Sheets
              - generic [ref=e322]:
                - generic [ref=e324]: A
                - generic [ref=e325]: B
                - generic [ref=e326]: C
                - generic [ref=e327]: "1"
                - generic [ref=e331]: "2"
                - generic [ref=e335]: "3"
          - generic [ref=e339]:
            - generic [ref=e340]: Education
            - heading "Education Administration" [level=3] [ref=e346]
            - list [ref=e347]:
              - listitem [ref=e348]: Students, teachers & administrators
              - listitem [ref=e350]: Classes, courses & timetables
              - listitem [ref=e352]: Attendance, assignments & online class meetings where enabled
              - listitem [ref=e354]: Exams, results & fee records
          - generic [ref=e356]:
            - generic [ref=e357]: Tavro AI
            - heading "Workspace Assistance" [level=3] [ref=e363]
            - list [ref=e364]:
              - listitem [ref=e365]: Ask about accessible information
              - listitem [ref=e367]: Summarize supported records
              - listitem [ref=e369]: Use available actions
              - listitem [ref=e371]: Respect role and plan access
        - generic [ref=e373]:
          - generic [ref=e374]:
            - paragraph [ref=e375]: One connected workspace
            - paragraph [ref=e376]: Tools for personal work, teams, and learning—with access shaped by your workspace.
          - list "Personal, Company, Education, and Tavro AI workspaces" [ref=e377]:
            - listitem [ref=e378]:
              - generic [ref=e384]:
                - generic [ref=e385]: Personal
                - generic [ref=e386]: Focus & planning
            - listitem [ref=e389]:
              - generic [ref=e396]:
                - generic [ref=e397]: Company
                - generic [ref=e398]: Teams & customers
            - listitem [ref=e401]:
              - generic [ref=e406]:
                - generic [ref=e407]: Education
                - generic [ref=e408]: Academic work
            - listitem [ref=e411]:
              - generic [ref=e417]:
                - generic [ref=e418]: Tavro AI
                - generic [ref=e419]: Workspace assistance
    - region [ref=e420]:
      - generic [ref=e422]:
        - generic [ref=e423]:
          - generic [ref=e424]: CRM
          - heading "Company workspace CRM. Move every opportunity forward." [level=2] [ref=e425]: Company workspace CRM.Move every opportunity forward.
          - paragraph [ref=e426]: Keep contacts, companies, conversations, and follow-ups connected in the Company workspace. CRM is not part of School, College, or University experiences.
          - list [ref=e427]:
            - listitem [ref=e428]: Contacts & companies in one view
            - listitem [ref=e432]: Activity timeline with all interactions
            - listitem [ref=e436]: Linked tasks, meetings and notes
            - listitem [ref=e440]: Stage-by-stage pipeline tracking
        - generic [ref=e445]:
          - generic [ref=e446]:
            - generic [ref=e447]: CRM
            - generic [ref=e453]: Search customers…
          - list "Company relationship flow" [ref=e460]:
            - listitem [ref=e461]:
              - generic [ref=e467]: Company
            - listitem [ref=e470]:
              - generic [ref=e477]: Contact
            - listitem [ref=e480]:
              - generic [ref=e485]: Deal
            - listitem [ref=e488]:
              - generic [ref=e492]: Activity
          - generic [ref=e493]:
            - generic [ref=e494]:
              - paragraph [ref=e496]: Companies · 4
              - button "AC Acme Corporation Negotiation Proposal sent · 2h" [ref=e497] [cursor=pointer]:
                - generic [ref=e498]: AC
                - generic [ref=e499]:
                  - generic [ref=e500]:
                    - generic [ref=e501]: Acme Corporation
                    - generic [ref=e502]: Negotiation
                  - paragraph [ref=e503]: Proposal sent · 2h
              - button "GI Globex Industries Qualified Follow-up due · Today" [ref=e504] [cursor=pointer]:
                - generic [ref=e505]: GI
                - generic [ref=e506]:
                  - generic [ref=e507]:
                    - generic [ref=e508]: Globex Industries
                    - generic [ref=e509]: Qualified
                  - paragraph [ref=e510]: Follow-up due · Today
              - button "IG Initech Group Won Contract signed · 1d" [ref=e511] [cursor=pointer]:
                - generic [ref=e512]: IG
                - generic [ref=e513]:
                  - generic [ref=e514]:
                    - generic [ref=e515]: Initech Group
                    - generic [ref=e516]: Won
                  - paragraph [ref=e517]: Contract signed · 1d
              - button "UC Umbrella Corp Lead Intro call · 3d" [ref=e518] [cursor=pointer]:
                - generic [ref=e519]: UC
                - generic [ref=e520]:
                  - generic [ref=e521]:
                    - generic [ref=e522]: Umbrella Corp
                    - generic [ref=e523]: Lead
                  - paragraph [ref=e524]: Intro call · 3d
            - generic [ref=e526]:
              - generic [ref=e528]:
                - generic [ref=e529]: AC
                - generic [ref=e530]:
                  - paragraph [ref=e531]: Acme Corporation
                  - paragraph [ref=e532]: David Park
              - generic [ref=e538]:
                - generic [ref=e539]:
                  - paragraph [ref=e540]: Status
                  - text: Active
                - generic [ref=e541]:
                  - paragraph [ref=e542]: Deal Value
                  - paragraph [ref=e543]: $48,000
              - generic [ref=e544]:
                - paragraph [ref=e545]: Pipeline Stage
                - paragraph [ref=e556]: Negotiation
              - generic [ref=e557]:
                - paragraph [ref=e558]: Activity
                - generic [ref=e559]:
                  - generic [ref=e560]:
                    - generic [ref=e563]: Discovery call — 45 min
                    - generic [ref=e564]: 3d ago
                  - generic [ref=e565]:
                    - generic [ref=e569]: Proposal deck sent
                    - generic [ref=e570]: 2h ago
                  - generic [ref=e571]:
                    - generic [ref=e575]: Follow-up scheduled
                    - generic [ref=e576]: Tomorrow
    - generic [ref=e579]:
      - generic [ref=e581]:
        - generic [ref=e582]:
          - generic [ref=e583]: Team
          - generic [ref=e590]: 32 members · 6 departments
        - generic [ref=e591]:
          - generic [ref=e592]:
            - generic [ref=e593]:
              - generic [ref=e594]: Engineering
              - generic [ref=e597]: 12 members
            - generic [ref=e598]:
              - generic [ref=e599]:
                - generic [ref=e600]: A
                - generic [ref=e603]:
                  - generic [ref=e604]:
                    - generic [ref=e605]: Alex R.
                    - generic [ref=e606]: Lead Dev
                  - generic [ref=e607]: API optimisation
              - generic [ref=e611]:
                - generic [ref=e612]: M
                - generic [ref=e615]:
                  - generic [ref=e616]:
                    - generic [ref=e617]: Mia C.
                    - generic [ref=e618]: Frontend
                  - generic [ref=e619]: Dashboard redesign
              - generic [ref=e623]:
                - generic [ref=e624]: T
                - generic [ref=e627]:
                  - generic [ref=e628]:
                    - generic [ref=e629]: Tom L.
                    - generic [ref=e630]: DevOps
                  - generic [ref=e631]: CI pipeline fix
          - generic [ref=e635]:
            - generic [ref=e636]:
              - generic [ref=e637]: Design
              - generic [ref=e640]: 6 members
            - generic [ref=e641]:
              - generic [ref=e642]:
                - generic [ref=e643]: S
                - generic [ref=e646]:
                  - generic [ref=e647]:
                    - generic [ref=e648]: Sara J.
                    - generic [ref=e649]: Product Designer
                  - generic [ref=e650]: Onboarding flow
              - generic [ref=e654]:
                - generic [ref=e655]: J
                - generic [ref=e658]:
                  - generic [ref=e659]:
                    - generic [ref=e660]: Jake M.
                    - generic [ref=e661]: Brand
                  - generic [ref=e662]: Brand update
      - generic [ref=e666]:
        - generic [ref=e667]: Team Management
        - heading "Know your people. Align the work." [level=2] [ref=e668]: Know your people.Align the work.
        - paragraph [ref=e669]: See who is working on what, across every department. Workload visibility, roles, status and active projects — all in one place.
        - list [ref=e670]:
          - listitem [ref=e671]: Departments, roles & permissions
          - listitem [ref=e673]: Member status & activity
          - listitem [ref=e675]: Member profiles & skills
          - listitem [ref=e677]: Cross-team project visibility
    - generic [ref=e680]:
      - generic [ref=e681]:
        - heading "From conversation to completion." [level=2] [ref=e682]
        - paragraph [ref=e683]: Bring chats, tasks, projects, meetings, and follow-up together in a shared workspace.
      - generic [ref=e684]:
        - generic [ref=e690]:
          - generic [ref=e695]:
            - paragraph [ref=e696]: Step 1
            - paragraph [ref=e697]: Chat
          - generic [ref=e698]:
            - generic [ref=e699]: "#product"
            - generic [ref=e704]:
              - generic [ref=e705]: SR
              - paragraph [ref=e707]: "\"Let's finish the onboarding redesign before launch.\""
        - generic [ref=e713]:
          - generic [ref=e719]:
            - paragraph [ref=e720]: Step 2
            - paragraph [ref=e721]: Task
          - generic [ref=e722]:
            - generic [ref=e723]:
              - generic [ref=e724]: New Task
              - generic [ref=e725]: High
            - paragraph [ref=e726]: Finish onboarding redesign
            - generic [ref=e727]:
              - generic [ref=e728]: → Onboarding Project
              - generic [ref=e729]: Due Friday
        - generic [ref=e735]:
          - generic [ref=e741]:
            - paragraph [ref=e742]: Step 3
            - paragraph [ref=e743]: Meeting
          - generic [ref=e744]:
            - generic [ref=e745]:
              - generic [ref=e746]: SAMPLE
              - generic [ref=e749]: Design Review
            - generic [ref=e750]:
              - generic [ref=e751]: SR
              - generic [ref=e752]: AR
              - generic [ref=e753]: MC
        - generic [ref=e755]:
          - generic [ref=e761]:
            - paragraph [ref=e762]: Step 4
            - paragraph [ref=e763]: Tavro AI Summary
          - generic [ref=e764]:
            - generic [ref=e765]: Tavro AI Summary
            - list [ref=e770]:
              - listitem [ref=e771]: ✓ Redesign approved
              - listitem [ref=e772]: 3 tasks created
              - listitem [ref=e773]: 1 Acme demo scheduled
      - generic [ref=e774]:
        - generic [ref=e775]:
          - heading "Calendar → Meeting → Team" [level=3] [ref=e777]
          - generic [ref=e780]:
            - generic [ref=e781]:
              - paragraph [ref=e785]: Schedule
              - paragraph [ref=e786]: Design Review
            - generic [ref=e789]:
              - paragraph [ref=e794]: Meeting
              - paragraph [ref=e795]: Shared room
            - generic [ref=e798]:
              - paragraph [ref=e805]: Team
              - paragraph [ref=e806]: People together
        - generic [ref=e807]:
          - heading "Automation" [level=3] [ref=e809]
          - generic [ref=e812]:
            - generic [ref=e813]:
              - paragraph [ref=e817]: Trigger
              - paragraph [ref=e818]: CRM follow-up due
            - generic [ref=e821]:
              - paragraph [ref=e827]: Workflow
              - paragraph [ref=e828]: Create task reminder
            - generic [ref=e831]:
              - paragraph [ref=e836]: Result
              - paragraph [ref=e837]: Team stays on track
    - generic [ref=e840]:
      - generic [ref=e841]:
        - generic [ref=e842]: Tasks & Projects
        - heading "Know what needs to happen next." [level=2] [ref=e843]
        - paragraph [ref=e844]: Organize tasks, priorities, assignments, and due dates, then follow project status and progress. Milestone and Gantt timeline planning is coming soon.
        - list [ref=e845]:
          - listitem [ref=e846]: Task board and list views
          - listitem [ref=e850]: Project status and progress
          - listitem [ref=e854]: Priority, assignee and due dates
          - listitem [ref=e858]: Related work with CRM and meetings
      - generic [ref=e863]:
        - generic [ref=e864]:
          - generic [ref=e865]: Onboarding Project
          - generic [ref=e870]:
            - generic [ref=e871]: 8 tasks
            - generic [ref=e874]: 62%
        - 'generic "Task pipeline: To Do, In Progress, Review, Done" [ref=e875]':
          - generic [ref=e877]: To Do
          - generic [ref=e880]: In Progress
          - generic [ref=e883]: Review
          - generic [ref=e886]: Done
        - generic [ref=e890]:
          - generic [ref=e891]:
            - generic [ref=e892]:
              - generic [ref=e894]: To Do
              - generic [ref=e895]: "2"
            - generic [ref=e896]:
              - generic [ref=e897]:
                - paragraph [ref=e898]: Write Q4 proposal
                - text: High
              - generic [ref=e899]:
                - paragraph [ref=e900]: Update docs
                - text: Normal
          - generic [ref=e901]:
            - generic [ref=e902]:
              - generic [ref=e904]: In Progress
              - generic [ref=e905]: "2"
            - generic [ref=e906]:
              - generic [ref=e907]:
                - paragraph [ref=e908]: Onboarding redesign
                - text: High
              - generic [ref=e909]:
                - paragraph [ref=e910]: API review
                - text: Normal
          - generic [ref=e911]:
            - generic [ref=e912]:
              - generic [ref=e914]: Review
              - generic [ref=e915]: "1"
            - generic [ref=e917]:
              - paragraph [ref=e918]: Acme demo deck
              - text: Urgent
          - generic [ref=e919]:
            - generic [ref=e920]:
              - generic [ref=e922]: Done
              - generic [ref=e923]: "1"
            - generic [ref=e925]:
              - paragraph [ref=e926]: Contract signed
              - text: High
    - region [ref=e927]:
      - generic [ref=e929]:
        - group "Tavro AI turns a user request into workspace actions" [ref=e931]:
          - generic [ref=e932]:
            - generic [ref=e933]: Workspace assistance
            - generic [ref=e934]: Context connected
          - generic [ref=e936]:
            - generic [ref=e937]:
              - generic [ref=e938]: You
              - paragraph [ref=e941]: Help me prioritize the work due today.
            - generic [ref=e944]:
              - generic [ref=e945]: Tavro AI
              - paragraph [ref=e949]: Works with supported information available to your account.
            - generic [ref=e952]:
              - generic [ref=e953]: Actions & results
              - paragraph [ref=e957]: Tavro AI can help review tasks and deadlines available in your workspace.
        - generic [ref=e958]:
          - generic [ref=e959]: Tavro AI for work and learning
          - heading "Support for work and learning. Meet Tavro AI." [level=2] [ref=e964]:
            - text: Support for work and learning.
            - generic [ref=e965]: Meet Tavro AI.
          - paragraph [ref=e966]: Tavro AI can help with supported business, personal, and academic workspace information—from organizing work to learning support. Available information and actions depend on your workspace, role, and plan.
          - link "Try Tavro AI" [ref=e967] [cursor=pointer]:
            - /url: /ai
    - region [ref=e970]:
      - generic [ref=e972]:
        - generic [ref=e973]:
          - generic [ref=e974]: Security
          - heading "Built for work and learning." [level=2] [ref=e978]
          - paragraph [ref=e979]: WorkGrind applies authentication and workspace permissions to supported areas. Available controls vary by feature and account.
          - img "Illustration of account authentication, workspace permissions, and recorded activity where available" [ref=e980]:
            - generic [ref=e981]: Protected workspace data flow
            - generic [ref=e984]:
              - generic [ref=e985]:
                - paragraph [ref=e992]: Role access
                - paragraph [ref=e993]: Feature permissions
              - generic [ref=e995]:
                - paragraph [ref=e1000]: Workspace
                - paragraph [ref=e1001]: Tenant scoping
              - generic [ref=e1003]:
                - paragraph [ref=e1008]: Activity
                - paragraph [ref=e1009]: Where available
        - generic [ref=e1010]:
          - generic [ref=e1011]:
            - heading "Role-Based Access" [level=3] [ref=e1018]
            - paragraph [ref=e1019]: Workspace membership and role permissions govern access to supported features.
          - generic [ref=e1020]:
            - heading "Workspace Scoping" [level=3] [ref=e1024]
            - paragraph [ref=e1025]: Workspace context is used to scope access to tenant data.
          - generic [ref=e1026]:
            - heading "Authentication" [level=3] [ref=e1031]
            - paragraph [ref=e1032]: WorkGrind uses account authentication and session controls.
          - generic [ref=e1033]:
            - heading "Activity Records" [level=3] [ref=e1038]
            - paragraph [ref=e1039]: Some privileged actions are recorded where audit logging is available.
    - region "Get started with WorkGrind" [ref=e1040]:
      - generic [ref=e1042]:
        - generic [ref=e1043]: Choose your WorkGrind workspace
        - heading "Your workspace for work and learning." [level=2] [ref=e1046]:
          - text: Your workspace for
          - generic [ref=e1047]: work and learning.
        - paragraph [ref=e1048]: Find the right tools for personal productivity, company collaboration, or academic administration.
        - generic [ref=e1049]:
          - link "Get Started" [ref=e1050] [cursor=pointer]:
            - /url: /signup
          - button "Explore Features" [ref=e1053] [cursor=pointer]
        - img "Illustration of WorkGrind capabilities for personal, business, and academic workspaces" [ref=e1054]:
          - generic [ref=e1055]:
            - generic [ref=e1057]: Personal
            - generic [ref=e1063]: Company
            - generic [ref=e1070]: Classes
            - generic [ref=e1075]: Faculty
            - generic [ref=e1081]: Tavro AI
        - generic [ref=e1087]:
          - generic [ref=e1088]: Solo
          - generic [ref=e1090]: Company
          - generic [ref=e1092]: School / Academy
          - generic [ref=e1094]: College / University
    - contentinfo [ref=e1096]:
      - generic [ref=e1097]:
        - generic [ref=e1098]:
          - generic [ref=e1099]:
            - img "WorkGrind" [ref=e1100]:
              - generic [aria-hidden] [ref=e1104]:
                - generic [ref=e1105]: Work
                - generic [ref=e1106]: Grind
            - paragraph [ref=e1107]: A connected workspace for personal work, business, and education.
            - link "Follow WorkGrind on Instagram" [ref=e1109] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
            - paragraph [ref=e1114]: © 2026 WorkGrind. All rights reserved.
          - generic [ref=e1115]:
            - heading "Company" [level=3] [ref=e1116]
            - list [ref=e1117]:
              - listitem [ref=e1118]:
                - link "About" [ref=e1119] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e1120]:
                - link "Features" [ref=e1121] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e1122]:
                - link "Demo" [ref=e1123] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=e1124]:
                - link "Contact" [ref=e1125] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e1126]:
            - heading "Legal" [level=3] [ref=e1127]
            - list [ref=e1128]:
              - listitem [ref=e1129]:
                - link "Privacy Policy" [ref=e1130] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e1131]:
                - link "Terms of Service" [ref=e1132] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e1133]:
                - link "Cookie Preferences" [ref=e1134] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e1135]:
                - link "Refund Policy" [ref=e1136] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=e1137]:
                - link "Cancellation Policy" [ref=e1138] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=e1139]:
                - link "Disclaimer" [ref=e1140] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=e1141]:
            - heading "Trust & Security" [level=3] [ref=e1142]
            - list [ref=e1143]:
              - listitem [ref=e1144]:
                - link "Security" [ref=e1145] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e1146]:
                - link "Responsible Disclosure" [ref=e1147] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=e1148]:
                - link "Accessibility" [ref=e1149] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=e1150]:
                - link "Data Processing Agreement" [ref=e1151] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=e1152]:
                - link "Acceptable Use" [ref=e1153] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e1154]:
                - link "Community Guidelines" [ref=e1155] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=e1156]:
            - heading "Support" [level=3] [ref=e1157]
            - list [ref=e1158]:
              - listitem [ref=e1159]:
                - link "Help Center" [ref=e1160] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=e1161]:
                - link "Support" [ref=e1162] [cursor=pointer]:
                  - /url: /support
        - generic [ref=e1163]:
          - paragraph [ref=e1164]: Choose a Solo, Company, School, College, or University workspace.
          - button "English , select language" [ref=e1166] [cursor=pointer]:
            - generic [ref=e1170]: English
            - generic [ref=e1171]: ", select language"
  - alert [ref=e1174]
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