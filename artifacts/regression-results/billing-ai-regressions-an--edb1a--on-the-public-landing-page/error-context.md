# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> an expired or revoked refresh credential leaves a logged-out visitor on the public landing page
- Location: tests\billing-ai-regressions.spec.ts:599:5

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 1
Received length: 2
Received array:  [{"type": "navigate", "url": "http://127.0.0.1:3101/"}, {"type": "navigate", "url": "http://127.0.0.1:3101/"}]
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
              - generic [ref=e77]: WorkGrind — Overview
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
                - paragraph [ref=e142]: Overview
                - paragraph [ref=e143]: Good morning, Sarah Chen ☀️
              - generic [ref=e144]:
                - generic [ref=e145]:
                  - paragraph [ref=e146]: Open Tasks
                  - text: "12"
                  - paragraph [ref=e147]: +2 today
                - generic [ref=e148]:
                  - paragraph [ref=e149]: Active Projects
                  - text: "4"
                  - paragraph [ref=e150]: 2 on track
                - generic [ref=e151]:
                  - paragraph [ref=e152]: Meetings Today
                  - text: "3"
                  - paragraph [ref=e153]: 1 in 45m
              - generic [ref=e154]:
                - paragraph [ref=e155]: My Tasks
                - generic [ref=e156]:
                  - generic [ref=e157]:
                    - generic [ref=e159]: Review Acme proposal
                    - generic [ref=e160]: Urgent
                  - generic [ref=e161]:
                    - generic [ref=e163]: Update onboarding docs
                    - generic [ref=e164]: High
                  - generic [ref=e165]:
                    - generic [ref=e167]: Q4 planning session
                    - generic [ref=e168]: Normal
              - generic [ref=e169]:
                - paragraph [ref=e170]: Today's Meetings
                - generic [ref=e171]:
                  - generic [ref=e172]:
                    - generic [ref=e173]: 2:00 PM
                    - paragraph [ref=e178]: Acme Demo Call
                    - paragraph [ref=e179]: 4 people
                  - generic [ref=e180]:
                    - generic [ref=e181]: 4:30 PM
                    - paragraph [ref=e186]: Sprint Review
                    - paragraph [ref=e187]: 6 people
          - generic [ref=e188]:
            - generic [ref=e189]: Overview
            - generic [ref=e204]: Illustrative Preview
          - group "Choose a product preview scene" [ref=e207]:
            - button "Show Overview preview" [pressed] [ref=e208] [cursor=pointer]:
              - generic [ref=e214]: Overview
            - button "Show Tasks preview" [ref=e215] [cursor=pointer]:
              - generic [ref=e219]: Tasks
            - button "Show CRM preview" [ref=e220] [cursor=pointer]:
              - generic [ref=e225]: CRM
            - button "Show Team preview" [ref=e226] [cursor=pointer]:
              - generic [ref=e232]: Team
            - button "Show Collaboration preview" [ref=e233] [cursor=pointer]:
              - generic [ref=e236]: Collaboration
            - button "Show Tavro AI preview" [ref=e237] [cursor=pointer]:
              - generic [ref=e241]: Tavro AI
          - img "Illustrative WorkGrind preview spanning personal work, business, and academic workspaces" [ref=e242]:
            - generic [ref=e244]:
              - generic [ref=e245]: Personal
              - generic [ref=e251]: Business
              - generic [ref=e258]: Classes
              - generic [ref=e263]: Academics
              - generic [ref=e269]: Tavro AI
    - region [ref=e275]:
      - generic [ref=e276]:
        - generic [ref=e277]:
          - heading "One workspace for work and learning." [level=2] [ref=e278]
          - paragraph [ref=e279]: WorkGrind brings personal work, business and office teams, and education administration together. Choose Solo, Company, School / Academy, College, or University; available features depend on workspace, role, and plan.
        - generic [ref=e280]:
          - generic [ref=e281]:
            - generic [ref=e282]: Solo
            - heading "Personal Work & Freelance" [level=3] [ref=e288]
            - list [ref=e289]:
              - listitem [ref=e290]: Daily focus & priorities
              - listitem [ref=e292]: Tasks, projects & planning
              - listitem [ref=e294]: Calendar & documents
              - listitem [ref=e296]: Tavro AI assistance where available
          - generic [ref=e298]:
            - generic [ref=e299]: Company
            - heading "Business & Office" [level=3] [ref=e307]
            - list [ref=e308]:
              - listitem [ref=e309]: Team chat & meetings
              - listitem [ref=e311]: Tasks, projects & shared work
              - listitem [ref=e313]: CRM & client portal
              - listitem [ref=e315]: Documents, files, workflows & analytics
            - generic "Sheets spreadsheet preview" [ref=e317]:
              - generic [ref=e318]: Sheets
              - generic [ref=e321]:
                - generic [ref=e323]: A
                - generic [ref=e324]: B
                - generic [ref=e325]: C
                - generic [ref=e326]: "1"
                - generic [ref=e330]: "2"
                - generic [ref=e334]: "3"
          - generic [ref=e338]:
            - generic [ref=e339]: Education
            - heading "Education Administration" [level=3] [ref=e345]
            - list [ref=e346]:
              - listitem [ref=e347]: Students, teachers & administrators
              - listitem [ref=e349]: Classes, courses & timetables
              - listitem [ref=e351]: Attendance, assignments & online class meetings where enabled
              - listitem [ref=e353]: Exams, results & fee records
          - generic [ref=e355]:
            - generic [ref=e356]: Tavro AI
            - heading "Workspace Assistance" [level=3] [ref=e362]
            - list [ref=e363]:
              - listitem [ref=e364]: Ask about accessible information
              - listitem [ref=e366]: Summarize supported records
              - listitem [ref=e368]: Use available actions
              - listitem [ref=e370]: Respect role and plan access
        - generic [ref=e372]:
          - generic [ref=e373]:
            - paragraph [ref=e374]: One connected workspace
            - paragraph [ref=e375]: Tools for personal work, teams, and learning—with access shaped by your workspace.
          - list "Personal, Company, Education, and Tavro AI workspaces" [ref=e376]:
            - listitem [ref=e377]:
              - generic [ref=e383]:
                - generic [ref=e384]: Personal
                - generic [ref=e385]: Focus & planning
            - listitem [ref=e388]:
              - generic [ref=e395]:
                - generic [ref=e396]: Company
                - generic [ref=e397]: Teams & customers
            - listitem [ref=e400]:
              - generic [ref=e405]:
                - generic [ref=e406]: Education
                - generic [ref=e407]: Academic work
            - listitem [ref=e410]:
              - generic [ref=e416]:
                - generic [ref=e417]: Tavro AI
                - generic [ref=e418]: Workspace assistance
    - region [ref=e419]:
      - generic [ref=e421]:
        - generic [ref=e422]:
          - generic [ref=e423]: CRM
          - heading "Company workspace CRM. Move every opportunity forward." [level=2] [ref=e424]: Company workspace CRM.Move every opportunity forward.
          - paragraph [ref=e425]: Keep contacts, companies, conversations, and follow-ups connected in the Company workspace. CRM is not part of School, College, or University experiences.
          - list [ref=e426]:
            - listitem [ref=e427]: Contacts & companies in one view
            - listitem [ref=e431]: Activity timeline with all interactions
            - listitem [ref=e435]: Linked tasks, meetings and notes
            - listitem [ref=e439]: Stage-by-stage pipeline tracking
        - generic [ref=e444]:
          - generic [ref=e445]:
            - generic [ref=e446]: CRM
            - generic [ref=e452]:
              - generic [ref=e453]: Search customers…
              - button [ref=e457] [cursor=pointer]
          - list "Company relationship flow" [ref=e459]:
            - listitem [ref=e460]:
              - generic [ref=e466]: Company
            - listitem [ref=e469]:
              - generic [ref=e476]: Contact
            - listitem [ref=e479]:
              - generic [ref=e484]: Deal
            - listitem [ref=e487]:
              - generic [ref=e491]: Activity
          - generic [ref=e492]:
            - generic [ref=e493]:
              - paragraph [ref=e495]: Companies · 4
              - button "AC Acme Corporation Negotiation Proposal sent · 2h" [ref=e496] [cursor=pointer]:
                - generic [ref=e497]: AC
                - generic [ref=e498]:
                  - generic [ref=e499]:
                    - generic [ref=e500]: Acme Corporation
                    - generic [ref=e501]: Negotiation
                  - paragraph [ref=e502]: Proposal sent · 2h
              - button "GI Globex Industries Qualified Follow-up due · Today" [ref=e503] [cursor=pointer]:
                - generic [ref=e504]: GI
                - generic [ref=e505]:
                  - generic [ref=e506]:
                    - generic [ref=e507]: Globex Industries
                    - generic [ref=e508]: Qualified
                  - paragraph [ref=e509]: Follow-up due · Today
              - button "IG Initech Group Won Contract signed · 1d" [ref=e510] [cursor=pointer]:
                - generic [ref=e511]: IG
                - generic [ref=e512]:
                  - generic [ref=e513]:
                    - generic [ref=e514]: Initech Group
                    - generic [ref=e515]: Won
                  - paragraph [ref=e516]: Contract signed · 1d
              - button "UC Umbrella Corp Lead Intro call · 3d" [ref=e517] [cursor=pointer]:
                - generic [ref=e518]: UC
                - generic [ref=e519]:
                  - generic [ref=e520]:
                    - generic [ref=e521]: Umbrella Corp
                    - generic [ref=e522]: Lead
                  - paragraph [ref=e523]: Intro call · 3d
            - generic [ref=e525]:
              - generic [ref=e526]:
                - generic [ref=e527]:
                  - generic [ref=e528]: AC
                  - generic [ref=e529]:
                    - paragraph [ref=e530]: Acme Corporation
                    - paragraph [ref=e531]: David Park
                - button [ref=e532] [cursor=pointer]
              - generic [ref=e537]:
                - generic [ref=e538]:
                  - paragraph [ref=e539]: Status
                  - text: Active
                - generic [ref=e540]:
                  - paragraph [ref=e541]: Deal Value
                  - paragraph [ref=e542]: $48,000
              - generic [ref=e543]:
                - paragraph [ref=e544]: Pipeline Stage
                - paragraph [ref=e555]: Negotiation
              - generic [ref=e556]:
                - paragraph [ref=e557]: Activity
                - generic [ref=e558]:
                  - generic [ref=e559]:
                    - generic [ref=e562]: Discovery call — 45 min
                    - generic [ref=e563]: 3d ago
                  - generic [ref=e564]:
                    - generic [ref=e568]: Proposal deck sent
                    - generic [ref=e569]: 2h ago
                  - generic [ref=e570]:
                    - generic [ref=e574]: Follow-up scheduled
                    - generic [ref=e575]: Tomorrow
    - generic [ref=e578]:
      - generic [ref=e580]:
        - generic [ref=e581]:
          - generic [ref=e582]: Team
          - generic [ref=e589]: 32 members · 6 departments
        - generic [ref=e590]:
          - generic [ref=e591]:
            - generic [ref=e592]:
              - generic [ref=e593]: Engineering
              - generic [ref=e596]: 12 members
            - generic [ref=e597]:
              - generic [ref=e598]:
                - generic [ref=e599]: A
                - generic [ref=e602]:
                  - generic [ref=e603]:
                    - generic [ref=e604]: Alex R.
                    - generic [ref=e605]: Lead Dev
                  - generic [ref=e606]: API optimisation
              - generic [ref=e610]:
                - generic [ref=e611]: M
                - generic [ref=e614]:
                  - generic [ref=e615]:
                    - generic [ref=e616]: Mia C.
                    - generic [ref=e617]: Frontend
                  - generic [ref=e618]: Dashboard redesign
              - generic [ref=e622]:
                - generic [ref=e623]: T
                - generic [ref=e626]:
                  - generic [ref=e627]:
                    - generic [ref=e628]: Tom L.
                    - generic [ref=e629]: DevOps
                  - generic [ref=e630]: CI pipeline fix
          - generic [ref=e634]:
            - generic [ref=e635]:
              - generic [ref=e636]: Design
              - generic [ref=e639]: 6 members
            - generic [ref=e640]:
              - generic [ref=e641]:
                - generic [ref=e642]: S
                - generic [ref=e645]:
                  - generic [ref=e646]:
                    - generic [ref=e647]: Sara J.
                    - generic [ref=e648]: Product Designer
                  - generic [ref=e649]: Onboarding flow
              - generic [ref=e653]:
                - generic [ref=e654]: J
                - generic [ref=e657]:
                  - generic [ref=e658]:
                    - generic [ref=e659]: Jake M.
                    - generic [ref=e660]: Brand
                  - generic [ref=e661]: Brand update
      - generic [ref=e665]:
        - generic [ref=e666]: Team Management
        - heading "Know your people. Align the work." [level=2] [ref=e667]: Know your people.Align the work.
        - paragraph [ref=e668]: See who is working on what, across every department. Workload visibility, roles, status and active projects — all in one place.
        - list [ref=e669]:
          - listitem [ref=e670]: Departments, roles & permissions
          - listitem [ref=e672]: Member status & activity
          - listitem [ref=e674]: Member profiles & skills
          - listitem [ref=e676]: Cross-team project visibility
    - generic [ref=e679]:
      - generic [ref=e680]:
        - heading "From conversation to completion." [level=2] [ref=e681]
        - paragraph [ref=e682]: Bring chats, tasks, projects, meetings, and follow-up together in a shared workspace.
      - generic [ref=e683]:
        - generic [ref=e689]:
          - generic [ref=e694]:
            - paragraph [ref=e695]: Step 1
            - paragraph [ref=e696]: Chat
          - generic [ref=e697]:
            - generic [ref=e698]: "#product"
            - generic [ref=e703]:
              - generic [ref=e704]: SR
              - paragraph [ref=e706]: "\"Let's finish the onboarding redesign before launch.\""
        - generic [ref=e712]:
          - generic [ref=e718]:
            - paragraph [ref=e719]: Step 2
            - paragraph [ref=e720]: Task
          - generic [ref=e721]:
            - generic [ref=e722]:
              - generic [ref=e723]: New Task
              - generic [ref=e724]: High
            - paragraph [ref=e725]: Finish onboarding redesign
            - generic [ref=e726]:
              - generic [ref=e727]: → Onboarding Project
              - generic [ref=e728]: Due Friday
        - generic [ref=e734]:
          - generic [ref=e740]:
            - paragraph [ref=e741]: Step 3
            - paragraph [ref=e742]: Meeting
          - generic [ref=e743]:
            - generic [ref=e744]:
              - generic [ref=e745]: SAMPLE
              - generic [ref=e748]: Design Review
            - generic [ref=e749]:
              - generic [ref=e750]: SR
              - generic [ref=e751]: AR
              - generic [ref=e752]: MC
        - generic [ref=e754]:
          - generic [ref=e760]:
            - paragraph [ref=e761]: Step 4
            - paragraph [ref=e762]: Tavro AI Summary
          - generic [ref=e763]:
            - generic [ref=e764]: Tavro AI Summary
            - list [ref=e769]:
              - listitem [ref=e770]: ✓ Redesign approved
              - listitem [ref=e771]: 3 tasks created
              - listitem [ref=e772]: 1 Acme demo scheduled
      - generic [ref=e773]:
        - generic [ref=e774]:
          - heading "Calendar → Meeting → Team" [level=3] [ref=e776]
          - generic [ref=e779]:
            - generic [ref=e780]:
              - paragraph [ref=e784]: Schedule
              - paragraph [ref=e785]: Design Review
            - generic [ref=e788]:
              - paragraph [ref=e793]: Meeting
              - paragraph [ref=e794]: Shared room
            - generic [ref=e797]:
              - paragraph [ref=e804]: Team
              - paragraph [ref=e805]: People together
        - generic [ref=e806]:
          - heading "Automation" [level=3] [ref=e808]
          - generic [ref=e811]:
            - generic [ref=e812]:
              - paragraph [ref=e816]: Trigger
              - paragraph [ref=e817]: CRM follow-up due
            - generic [ref=e820]:
              - paragraph [ref=e826]: Workflow
              - paragraph [ref=e827]: Create task reminder
            - generic [ref=e830]:
              - paragraph [ref=e835]: Result
              - paragraph [ref=e836]: Team stays on track
    - generic [ref=e839]:
      - generic [ref=e840]:
        - generic [ref=e841]: Tasks & Projects
        - heading "Know what needs to happen next." [level=2] [ref=e842]
        - paragraph [ref=e843]: Organize tasks, priorities, assignments, and due dates, then follow project status and progress. Milestone and Gantt timeline planning is coming soon.
        - list [ref=e844]:
          - listitem [ref=e845]: Task board and list views
          - listitem [ref=e849]: Project status and progress
          - listitem [ref=e853]: Priority, assignee and due dates
          - listitem [ref=e857]: Related work with CRM and meetings
      - generic [ref=e862]:
        - generic [ref=e863]:
          - generic [ref=e864]: Onboarding Project
          - generic [ref=e869]:
            - generic [ref=e870]: 8 tasks
            - generic [ref=e873]: 62%
        - 'generic "Task pipeline: To Do, In Progress, Review, Done" [ref=e874]':
          - generic [ref=e876]: To Do
          - generic [ref=e879]: In Progress
          - generic [ref=e882]: Review
          - generic [ref=e885]: Done
        - generic [ref=e889]:
          - generic [ref=e890]:
            - generic [ref=e891]:
              - generic [ref=e893]: To Do
              - generic [ref=e894]: "2"
            - generic [ref=e895]:
              - generic [ref=e896]:
                - paragraph [ref=e897]: Write Q4 proposal
                - text: High
              - generic [ref=e898]:
                - paragraph [ref=e899]: Update docs
                - text: Normal
          - generic [ref=e900]:
            - generic [ref=e901]:
              - generic [ref=e903]: In Progress
              - generic [ref=e904]: "2"
            - generic [ref=e905]:
              - generic [ref=e906]:
                - paragraph [ref=e907]: Onboarding redesign
                - text: High
              - generic [ref=e908]:
                - paragraph [ref=e909]: API review
                - text: Normal
          - generic [ref=e910]:
            - generic [ref=e911]:
              - generic [ref=e913]: Review
              - generic [ref=e914]: "1"
            - generic [ref=e916]:
              - paragraph [ref=e917]: Acme demo deck
              - text: Urgent
          - generic [ref=e918]:
            - generic [ref=e919]:
              - generic [ref=e921]: Done
              - generic [ref=e922]: "1"
            - generic [ref=e924]:
              - paragraph [ref=e925]: Contract signed
              - text: High
    - region [ref=e926]:
      - generic [ref=e928]:
        - group "Tavro AI turns a user request into workspace actions" [ref=e930]:
          - generic [ref=e931]:
            - generic [ref=e932]: Workspace assistance
            - generic [ref=e933]: Context connected
          - generic [ref=e935]:
            - generic [ref=e936]:
              - generic [ref=e937]: You
              - paragraph [ref=e940]: Help me prioritize the work due today.
            - generic [ref=e943]:
              - generic [ref=e944]: Tavro AI
              - paragraph [ref=e948]: Works with supported information available to your account.
            - generic [ref=e951]:
              - generic [ref=e952]: Actions & results
              - paragraph [ref=e956]: Tavro AI can help review tasks and deadlines available in your workspace.
        - generic [ref=e957]:
          - generic [ref=e958]: Tavro AI for work and learning
          - heading "Support for work and learning. Meet Tavro AI." [level=2] [ref=e963]:
            - text: Support for work and learning.
            - generic [ref=e964]: Meet Tavro AI.
          - paragraph [ref=e965]: Tavro AI can help with supported business, personal, and academic workspace information—from organizing work to learning support. Available information and actions depend on your workspace, role, and plan.
          - link "Try Tavro AI" [ref=e966] [cursor=pointer]:
            - /url: /ai
    - region [ref=e969]:
      - generic [ref=e971]:
        - generic [ref=e972]:
          - generic [ref=e973]: Security
          - heading "Built for work and learning." [level=2] [ref=e977]
          - paragraph [ref=e978]: WorkGrind applies authentication and workspace permissions to supported areas. Available controls vary by feature and account.
          - img "Illustration of account authentication, workspace permissions, and recorded activity where available" [ref=e979]:
            - generic [ref=e980]: Protected workspace data flow
            - generic [ref=e983]:
              - generic [ref=e984]:
                - paragraph [ref=e991]: Role access
                - paragraph [ref=e992]: Feature permissions
              - generic [ref=e994]:
                - paragraph [ref=e999]: Workspace
                - paragraph [ref=e1000]: Tenant scoping
              - generic [ref=e1002]:
                - paragraph [ref=e1007]: Activity
                - paragraph [ref=e1008]: Where available
        - generic [ref=e1009]:
          - generic [ref=e1010]:
            - heading "Role-Based Access" [level=3] [ref=e1017]
            - paragraph [ref=e1018]: Workspace membership and role permissions govern access to supported features.
          - generic [ref=e1019]:
            - heading "Workspace Scoping" [level=3] [ref=e1023]
            - paragraph [ref=e1024]: Workspace context is used to scope access to tenant data.
          - generic [ref=e1025]:
            - heading "Authentication" [level=3] [ref=e1030]
            - paragraph [ref=e1031]: WorkGrind uses account authentication and session controls.
          - generic [ref=e1032]:
            - heading "Activity Records" [level=3] [ref=e1037]
            - paragraph [ref=e1038]: Some privileged actions are recorded where audit logging is available.
    - region "Get started with WorkGrind" [ref=e1039]:
      - generic [ref=e1041]:
        - generic [ref=e1042]: Choose your WorkGrind workspace
        - heading "Your workspace for work and learning." [level=2] [ref=e1045]:
          - text: Your workspace for
          - generic [ref=e1046]: work and learning.
        - paragraph [ref=e1047]: Find the right tools for personal productivity, company collaboration, or academic administration.
        - generic [ref=e1048]:
          - link "Get Started" [ref=e1049] [cursor=pointer]:
            - /url: /signup
          - button "Explore Features" [ref=e1052] [cursor=pointer]
        - img "Illustration of WorkGrind capabilities for personal, business, and academic workspaces" [ref=e1053]:
          - generic [ref=e1054]:
            - generic [ref=e1056]: Personal
            - generic [ref=e1062]: Company
            - generic [ref=e1069]: Classes
            - generic [ref=e1074]: Faculty
            - generic [ref=e1080]: Tavro AI
        - generic [ref=e1086]:
          - generic [ref=e1087]: Solo
          - generic [ref=e1089]: Company
          - generic [ref=e1091]: School / Academy
          - generic [ref=e1093]: College / University
    - contentinfo [ref=e1095]:
      - generic [ref=e1096]:
        - generic [ref=e1097]:
          - generic [ref=e1098]:
            - img "WorkGrind" [ref=e1099]:
              - generic [aria-hidden] [ref=e1103]:
                - generic [ref=e1104]: Work
                - generic [ref=e1105]: Grind
            - paragraph [ref=e1106]: A connected workspace for personal work, business, and education.
            - link "Follow WorkGrind on Instagram" [ref=e1108] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
            - paragraph [ref=e1113]: © 2026 WorkGrind. All rights reserved.
          - generic [ref=e1114]:
            - heading "Company" [level=3] [ref=e1115]
            - list [ref=e1116]:
              - listitem [ref=e1117]:
                - link "About" [ref=e1118] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e1119]:
                - link "Features" [ref=e1120] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e1121]:
                - link "Demo" [ref=e1122] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=e1123]:
                - link "Contact" [ref=e1124] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e1125]:
            - heading "Legal" [level=3] [ref=e1126]
            - list [ref=e1127]:
              - listitem [ref=e1128]:
                - link "Privacy Policy" [ref=e1129] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e1130]:
                - link "Terms of Service" [ref=e1131] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e1132]:
                - link "Cookie Preferences" [ref=e1133] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e1134]:
                - link "Refund Policy" [ref=e1135] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=e1136]:
                - link "Cancellation Policy" [ref=e1137] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=e1138]:
                - link "Disclaimer" [ref=e1139] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=e1140]:
            - heading "Trust & Security" [level=3] [ref=e1141]
            - list [ref=e1142]:
              - listitem [ref=e1143]:
                - link "Security" [ref=e1144] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e1145]:
                - link "Responsible Disclosure" [ref=e1146] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=e1147]:
                - link "Accessibility" [ref=e1148] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=e1149]:
                - link "Data Processing Agreement" [ref=e1150] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=e1151]:
                - link "Acceptable Use" [ref=e1152] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e1153]:
                - link "Community Guidelines" [ref=e1154] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=e1155]:
            - heading "Support" [level=3] [ref=e1156]
            - list [ref=e1157]:
              - listitem [ref=e1158]:
                - link "Help Center" [ref=e1159] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=e1160]:
                - link "Support" [ref=e1161] [cursor=pointer]:
                  - /url: /support
        - generic [ref=e1162]:
          - paragraph [ref=e1163]: Choose a Solo, Company, School, College, or University workspace.
          - button "Select language" [ref=e1165] [cursor=pointer]:
            - generic [ref=e1169]: English
  - button "Open Next.js Dev Tools" [ref=e1177] [cursor=pointer]
  - alert [ref=e1181]
```

# Test source

```ts
  522 |     const pathname = new URL(request.url()).pathname;
  523 |     if (pathname.endsWith('/auth/me')) {
  524 |       await route.fulfill({
  525 |         status: 200,
  526 |         contentType: 'application/json',
  527 |         body: JSON.stringify({
  528 |           success: true,
  529 |           user: {
  530 |             _id: 'signup-owner',
  531 |             fullName: 'School Owner',
  532 |             email: 'school-owner@example.test',
  533 |             role: 'owner',
  534 |             accountType: 'company',
  535 |             signupOrganizationType: 'school',
  536 |             companyId: null,
  537 |           },
  538 |         }),
  539 |       });
  540 |       return;
  541 |     }
  542 |     if (pathname.endsWith('/subscription/status')) {
  543 |       await route.fulfill({
  544 |         status: 200,
  545 |         contentType: 'application/json',
  546 |         body: JSON.stringify({ success: true, subscription: { hasActiveAccess: false } }),
  547 |       });
  548 |       return;
  549 |     }
  550 |     if (pathname.endsWith('/auth/create-company')) {
  551 |       createCompanyAuthorization = request.headers().authorization ?? '';
  552 |       createCompanyBody = request.postDataJSON() as Record<string, unknown>;
  553 |       await route.fulfill({
  554 |         status: 201,
  555 |         contentType: 'application/json',
  556 |         body: JSON.stringify({
  557 |           success: true,
  558 |           accessToken: 'rotated-workspace-access',
  559 |           company: {
  560 |             _id: 'school-workspace',
  561 |             name: 'North School',
  562 |             ownerId: 'signup-owner',
  563 |             organizationType: 'school',
  564 |             accountType: 'company',
  565 |           },
  566 |           user: {
  567 |             _id: 'signup-owner',
  568 |             fullName: 'School Owner',
  569 |             email: 'school-owner@example.test',
  570 |             role: 'owner',
  571 |             accountType: 'company',
  572 |             companyId: 'school-workspace',
  573 |           },
  574 |         }),
  575 |       });
  576 |       return;
  577 |     }
  578 |     await route.fulfill({
  579 |       status: 200,
  580 |       contentType: 'application/json',
  581 |       body: JSON.stringify({ success: true }),
  582 |     });
  583 |   });
  584 |   await page.goto('/create-company');
  585 |   await page.getByPlaceholder('Apex Technologies').fill('North School');
  586 |   await page.getByRole('button', { name: 'Launch Workspace' }).click();
  587 | 
  588 |   await expect.poll(() => createCompanyAuthorization).toBe('Bearer playwright-regression-access');
  589 |   expect(createCompanyAuthorization).toBe('Bearer playwright-regression-access');
  590 |   expect(createCompanyBody).toMatchObject({
  591 |     name: 'North School',
  592 |     accountType: 'company',
  593 |     organizationType: 'school',
  594 |   });
  595 |   await expect.poll(() => page.evaluate(() => sessionStorage.getItem('workgrind_access_token')))
  596 |     .toBe('rotated-workspace-access');
  597 | });
  598 | 
  599 | test('an expired or revoked refresh credential leaves a logged-out visitor on the public landing page', async ({ page }) => {
  600 |   const refreshRequests: number[] = [];
  601 |   const mainFrameNavigations: Array<{ url: string; type?: string }> = [];
  602 |   page.on('framenavigated', (frame) => {
  603 |     if (frame === page.mainFrame()) {
  604 |       const navigation = { url: frame.url() };
  605 |       mainFrameNavigations.push(navigation);
  606 |       void frame.evaluate(() => performance.getEntriesByType('navigation')[0]?.type)
  607 |         .then((type) => { navigation.type = type; });
  608 |     }
  609 |   });
  610 |   await page.route('**/api/**', (route) => mockApi(route, {
  611 |     ...makeApiState(),
  612 |     failSubscriptionRequestAt: undefined,
  613 |     failFirstAgentRequest: false,
  614 |     refreshStatus: 401,
  615 |     refreshRequests,
  616 |   }));
  617 | 
  618 |   await page.goto('/');
  619 |   await expect(page).toHaveURL(/\/$/);
  620 |   await expect(page.getByRole('link', { name: /sign in|log in/i }).first()).toBeVisible();
  621 |   await page.waitForTimeout(500);
> 622 |   expect(mainFrameNavigations).toHaveLength(1);
      |                                ^ Error: expect(received).toHaveLength(expected)
  623 |   expect(refreshRequests).toHaveLength(1);
  624 | });
  625 | 
  626 | test('concurrent expired API requests share one refresh and preserve the current route', async ({ page }) => {
  627 |   const state = makeApiState();
  628 |   state.messages.push({
  629 |     role: 'assistant',
  630 |     content: 'Restored conversation',
  631 |     createdAt: new Date().toISOString(),
  632 |   });
  633 |   const refreshRequests: number[] = [];
  634 |   const unauthorizedPaths = new Map([
  635 |     ['/subscription/status', 1],
  636 |     [`/ai/agent/conversations/${conversationId}`, 1],
  637 |   ]);
  638 |   await page.addInitScript((id) => {
  639 |     sessionStorage.setItem('workgrind_access_token', 'playwright-expired-access');
  640 |     sessionStorage.setItem('workgrind:ai:active-conversation:playwright-user', id);
  641 |   }, conversationId);
  642 |   await page.route('**/api/**', (route) => mockApi(route, {
  643 |     ...state,
  644 |     failSubscriptionRequestAt: undefined,
  645 |     failFirstAgentRequest: false,
  646 |     refreshDelayMs: 150,
  647 |     refreshRequests,
  648 |     unauthorizedPaths,
  649 |   }));
  650 |   await page.goto('/ai');
  651 | 
  652 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  653 |   await expect(page.getByText('Restored conversation')).toBeVisible();
  654 |   expect(refreshRequests).toHaveLength(1);
  655 |   await expect(page).toHaveURL(/\/ai$/);
  656 | });
  657 | 
  658 | test('login 401 is not retried with a stale access token', async ({ page }) => {
  659 |   const refreshRequests: number[] = [];
  660 |   let loginRequests = 0;
  661 |   await page.route('**/api/**', async (route) => {
  662 |     const pathname = new URL(route.request().url()).pathname;
  663 |     if (pathname.endsWith('/auth/login')) {
  664 |       loginRequests += 1;
  665 |       await route.fulfill({
  666 |         status: 401,
  667 |         contentType: 'application/json',
  668 |         body: JSON.stringify({ success: false, message: 'Invalid credentials.' }),
  669 |       });
  670 |       return;
  671 |     }
  672 |     await mockApi(route, {
  673 |       ...makeApiState(),
  674 |       failSubscriptionRequestAt: undefined,
  675 |       failFirstAgentRequest: false,
  676 |       refreshStatus: 401,
  677 |       refreshRequests,
  678 |     });
  679 |   });
  680 |   await page.goto('/login');
  681 |   await page.getByLabel('Email address').fill('invalid@example.invalid');
  682 |   await expect.poll(() => refreshRequests.length).toBe(1);
  683 |   await page.evaluate(() => {
  684 |     sessionStorage.setItem('workgrind_access_token', 'playwright-stale-access');
  685 |   });
  686 |   await page.locator('#login-password').fill('not-a-real-secret');
  687 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  688 | 
  689 |   await expect(page.locator('.auth-error[role="alert"]')).toContainText('Invalid credentials.');
  690 |   expect(loginRequests).toBe(1);
  691 |   expect(refreshRequests).toHaveLength(1);
  692 |   await expect(page).toHaveURL(/\/login$/);
  693 | });
  694 | 
  695 | test('logout does not refresh a session after its logout request is rejected', async ({ page }) => {
  696 |   await setSessionAuth(page);
  697 |   const refreshRequests: number[] = [];
  698 |   let logoutRequests = 0;
  699 |   await page.route('**/api/**', async (route) => {
  700 |     const pathname = new URL(route.request().url()).pathname;
  701 |     if (pathname.endsWith('/auth/logout')) {
  702 |       logoutRequests += 1;
  703 |       await route.fulfill({
  704 |         status: 401,
  705 |         contentType: 'application/json',
  706 |         body: JSON.stringify({ success: false, message: 'Session already expired.' }),
  707 |       });
  708 |       return;
  709 |     }
  710 |     await mockApi(route, {
  711 |       ...makeApiState(),
  712 |       failSubscriptionRequestAt: undefined,
  713 |       failFirstAgentRequest: false,
  714 |       refreshRequests,
  715 |     });
  716 |   });
  717 |   await page.goto('/ai');
  718 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  719 |   await page.locator('aside button[aria-haspopup="menu"]').click();
  720 |   await page.getByRole('menuitem', { name: 'Sign out' }).click();
  721 | 
  722 |   await expect(page).toHaveURL(/\/login\?redirect=/);
```