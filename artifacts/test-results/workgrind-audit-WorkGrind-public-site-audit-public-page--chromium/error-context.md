# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /
- Location: tests\workgrind-audit.spec.ts:215:9

# Error details

```
Error: / audit issues

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "Button without accessible name: <button class=\"h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" str",
+   "Button without accessible name: <button class=\"text-slate-600 hover:text-slate-400 transition-colors\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejo",
+   "Old-brand text: TF",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e2]:
    - banner [ref=f1e3]:
      - generic [ref=f1e4]:
        - link "WorkGrind home" [ref=f1e5] [cursor=pointer]:
          - /url: /
          - img "WorkGrind" [ref=f1e6]:
            - generic [aria-hidden] [ref=f1e10]:
              - generic [ref=f1e11]: Work
              - generic [ref=f1e12]: Grind
        - navigation "Main navigation" [ref=f1e13]:
          - button "Product" [ref=f1e14] [cursor=pointer]
          - button "Solutions" [ref=f1e15] [cursor=pointer]
          - button "Features" [ref=f1e16] [cursor=pointer]
          - button "AI" [ref=f1e17] [cursor=pointer]
          - button "Security" [ref=f1e18] [cursor=pointer]
        - generic [ref=f1e19]:
          - button "Select language" [ref=f1e21] [cursor=pointer]:
            - generic [ref=f1e25]: English
          - link "Sign In" [ref=f1e28] [cursor=pointer]:
            - /url: /login
          - link "Get Started" [ref=f1e29] [cursor=pointer]:
            - /url: /signup
    - region "WorkGrind — CRM, team and work management" [ref=f1e30]:
      - generic [ref=f1e32]:
        - generic [ref=f1e33]:
          - generic [ref=f1e34]: The Connected Workspace for Modern Teams
          - heading "Run your team. Manage customers. Move work forward." [level=1] [ref=f1e36]: Run your team.Manage customers.Move work forward.
          - paragraph [ref=f1e37]: WorkGrind brings CRM, team collaboration, tasks, projects, meetings, documents and AI into one connected workspace for serious businesses.
          - generic [ref=f1e38]:
            - link "Start Free Trial" [ref=f1e39] [cursor=pointer]:
              - /url: /signup
            - link "See How It Works" [ref=f1e42] [cursor=pointer]:
              - /url: /how-it-works
          - generic [ref=f1e45]:
            - generic [ref=f1e46]: CRM & Contacts
            - generic [ref=f1e51]: Team Management
            - generic [ref=f1e57]: Tasks & Projects
            - generic [ref=f1e61]: Tavro AI
        - generic [ref=f1e66]:
          - generic [ref=f1e67]:
            - generic [ref=f1e71]:
              - generic [ref=f1e72]: TF
              - generic [ref=f1e74]: WorkGrind — Overview
            - generic [ref=f1e75]:
              - generic [ref=f1e76]: Search…
              - generic [ref=f1e84]: SC
          - generic [ref=f1e85]:
            - generic [ref=f1e86]:
              - generic [ref=f1e87]: Overview
              - generic [ref=f1e94]: CRM
              - generic [ref=f1e100]: Team
              - generic [ref=f1e107]: Chat
              - generic [ref=f1e111]: Tasks
              - generic [ref=f1e116]: Projects
              - generic [ref=f1e121]: Meetings
              - generic [ref=f1e126]: Calendar
              - generic [ref=f1e130]: Tavro AI
            - generic [ref=f1e137]:
              - generic [ref=f1e138]:
                - paragraph [ref=f1e139]: Overview
                - paragraph [ref=f1e140]: Good morning, Sarah Chen ☀️
              - generic [ref=f1e141]:
                - generic [ref=f1e142]:
                  - paragraph [ref=f1e143]: Open Tasks
                  - text: "12"
                  - paragraph [ref=f1e144]: +2 today
                - generic [ref=f1e145]:
                  - paragraph [ref=f1e146]: Active Projects
                  - text: "4"
                  - paragraph [ref=f1e147]: 2 on track
                - generic [ref=f1e148]:
                  - paragraph [ref=f1e149]: Meetings Today
                  - text: "3"
                  - paragraph [ref=f1e150]: 1 in 45m
              - generic [ref=f1e151]:
                - paragraph [ref=f1e152]: My Tasks
                - generic [ref=f1e153]:
                  - generic [ref=f1e154]:
                    - generic [ref=f1e156]: Review Acme proposal
                    - generic [ref=f1e157]: Urgent
                  - generic [ref=f1e158]:
                    - generic [ref=f1e160]: Update onboarding docs
                    - generic [ref=f1e161]: High
                  - generic [ref=f1e162]:
                    - generic [ref=f1e164]: Q4 planning session
                    - generic [ref=f1e165]: Normal
              - generic [ref=f1e166]:
                - paragraph [ref=f1e167]: Today's Meetings
                - generic [ref=f1e168]:
                  - generic [ref=f1e169]:
                    - generic [ref=f1e170]: 2:00 PM
                    - paragraph [ref=f1e175]: Acme Demo Call
                    - paragraph [ref=f1e176]: 4 people
                  - generic [ref=f1e177]:
                    - generic [ref=f1e178]: 4:30 PM
                    - paragraph [ref=f1e183]: Sprint Review
                    - paragraph [ref=f1e184]: 6 people
          - generic [ref=f1e185]:
            - generic [ref=f1e186]: Overview
            - generic [ref=f1e201]: Live Preview
          - group "Choose a product preview scene" [ref=f1e204]:
            - button "Show Overview preview" [pressed] [ref=f1e205] [cursor=pointer]:
              - generic [ref=f1e211]: Overview
            - button "Show Tasks preview" [ref=f1e212] [cursor=pointer]:
              - generic [ref=f1e216]: Tasks
            - button "Show CRM preview" [ref=f1e217] [cursor=pointer]:
              - generic [ref=f1e222]: CRM
            - button "Show Team preview" [ref=f1e223] [cursor=pointer]:
              - generic [ref=f1e229]: Team
            - button "Show Collaboration preview" [ref=f1e230] [cursor=pointer]:
              - generic [ref=f1e233]: Collaboration
            - button "Show Tavro AI preview" [ref=f1e234] [cursor=pointer]:
              - generic [ref=f1e238]: Tavro AI
          - img "WorkGrind connects CRM, Tasks, Calendar, Team, and Tavro AI" [ref=f1e239]:
            - generic [ref=f1e241]:
              - generic [ref=f1e242]: CRM
              - generic [ref=f1e249]: Tasks
              - generic [ref=f1e255]: Calendar
              - generic [ref=f1e260]: Team
              - generic [ref=f1e268]: Tavro AI
    - region [ref=f1e274]:
      - generic [ref=f1e275]:
        - generic [ref=f1e276]:
          - heading "Everything your business needs. Connected." [level=2] [ref=f1e277]
          - paragraph [ref=f1e278]: From customer relationships to team execution, WorkGrind keeps the entire workflow in one place.
        - generic [ref=f1e279]:
          - generic [ref=f1e280]:
            - generic [ref=f1e281]: CRM
            - heading "Customer Relationships" [level=3] [ref=f1e288]
            - list [ref=f1e289]:
              - listitem [ref=f1e290]: Contacts & companies
              - listitem [ref=f1e292]: Activity timeline
              - listitem [ref=f1e294]: Follow-ups & tasks
              - listitem [ref=f1e296]: Deal tracking
          - generic [ref=f1e298]:
            - generic [ref=f1e299]: Team
            - heading "People & Teams" [level=3] [ref=f1e307]
            - list [ref=f1e308]:
              - listitem [ref=f1e309]: Departments & roles
              - listitem [ref=f1e311]: Workload visibility
              - listitem [ref=f1e313]: Member profiles
              - listitem [ref=f1e315]: Status & presence
          - generic [ref=f1e317]:
            - generic [ref=f1e318]: Work
            - heading "Tasks & Projects" [level=3] [ref=f1e324]
            - list [ref=f1e325]:
              - listitem [ref=f1e326]: Kanban & list views
              - listitem [ref=f1e328]: Project milestones
              - listitem [ref=f1e330]: Meetings & calendar
              - listitem [ref=f1e332]: Files & documents
            - generic "Sheets spreadsheet preview" [ref=f1e334]:
              - generic [ref=f1e335]: Sheets
              - generic [ref=f1e338]:
                - generic [ref=f1e340]: A
                - generic [ref=f1e341]: B
                - generic [ref=f1e342]: C
                - generic [ref=f1e343]: "1"
                - generic [ref=f1e347]: "2"
                - generic [ref=f1e351]: "3"
          - generic [ref=f1e355]:
            - generic [ref=f1e356]: AI
            - heading "Intelligence Layer" [level=3] [ref=f1e362]
            - list [ref=f1e363]:
              - listitem [ref=f1e364]: Daily focus & priorities
              - listitem [ref=f1e366]: Meeting summaries
              - listitem [ref=f1e368]: Smart task creation
              - listitem [ref=f1e370]: Workspace search
        - generic [ref=f1e372]:
          - generic [ref=f1e373]:
            - paragraph [ref=f1e374]: One connected workspace
            - paragraph [ref=f1e375]: All connected. No switching tabs.
          - list "CRM to Team to Work to AI workflow" [ref=f1e376]:
            - listitem [ref=f1e377]:
              - generic [ref=f1e384]:
                - generic [ref=f1e385]: CRM
                - generic [ref=f1e386]: Customer context
            - listitem [ref=f1e389]:
              - generic [ref=f1e397]:
                - generic [ref=f1e398]: Team
                - generic [ref=f1e399]: People aligned
            - listitem [ref=f1e402]:
              - generic [ref=f1e408]:
                - generic [ref=f1e409]: Work
                - generic [ref=f1e410]: Tasks in motion
            - listitem [ref=f1e413]:
              - generic [ref=f1e419]:
                - generic [ref=f1e420]: AI
                - generic [ref=f1e421]: Tavro intelligence
    - region [ref=f1e422]:
      - generic [ref=f1e424]:
        - generic [ref=f1e425]:
          - generic [ref=f1e426]: CRM
          - heading "Know every customer. Move every opportunity forward." [level=2] [ref=f1e427]: Know every customer.Move every opportunity forward.
          - paragraph [ref=f1e428]: Every contact, company, conversation and follow-up — in one organised place. WorkGrind keeps your customer relationships moving.
          - list [ref=f1e429]:
            - listitem [ref=f1e430]: Contacts & companies in one view
            - listitem [ref=f1e434]: Activity timeline with all interactions
            - listitem [ref=f1e438]: Linked tasks, meetings and notes
            - listitem [ref=f1e442]: Stage-by-stage pipeline tracking
        - generic [ref=f1e447]:
          - generic [ref=f1e448]:
            - generic [ref=f1e449]: CRM
            - generic [ref=f1e455]:
              - generic [ref=f1e456]: Search customers…
              - button [ref=f1e460] [cursor=pointer]
          - list "Company relationship flow" [ref=f1e462]:
            - listitem [ref=f1e463]:
              - generic [ref=f1e469]: Company
            - listitem [ref=f1e472]:
              - generic [ref=f1e479]: Contact
            - listitem [ref=f1e482]:
              - generic [ref=f1e487]: Deal
            - listitem [ref=f1e490]:
              - generic [ref=f1e494]: Activity
          - generic [ref=f1e495]:
            - generic [ref=f1e496]:
              - paragraph [ref=f1e498]: Companies · 4
              - button "AC Acme Corporation Negotiation Proposal sent · 2h" [ref=f1e499] [cursor=pointer]:
                - generic [ref=f1e500]: AC
                - generic [ref=f1e501]:
                  - generic [ref=f1e502]:
                    - generic [ref=f1e503]: Acme Corporation
                    - generic [ref=f1e504]: Negotiation
                  - paragraph [ref=f1e505]: Proposal sent · 2h
              - button "GI Globex Industries Qualified Follow-up due · Today" [ref=f1e506] [cursor=pointer]:
                - generic [ref=f1e507]: GI
                - generic [ref=f1e508]:
                  - generic [ref=f1e509]:
                    - generic [ref=f1e510]: Globex Industries
                    - generic [ref=f1e511]: Qualified
                  - paragraph [ref=f1e512]: Follow-up due · Today
              - button "IG Initech Group Won Contract signed · 1d" [ref=f1e513] [cursor=pointer]:
                - generic [ref=f1e514]: IG
                - generic [ref=f1e515]:
                  - generic [ref=f1e516]:
                    - generic [ref=f1e517]: Initech Group
                    - generic [ref=f1e518]: Won
                  - paragraph [ref=f1e519]: Contract signed · 1d
              - button "UC Umbrella Corp Lead Intro call · 3d" [ref=f1e520] [cursor=pointer]:
                - generic [ref=f1e521]: UC
                - generic [ref=f1e522]:
                  - generic [ref=f1e523]:
                    - generic [ref=f1e524]: Umbrella Corp
                    - generic [ref=f1e525]: Lead
                  - paragraph [ref=f1e526]: Intro call · 3d
            - generic [ref=f1e528]:
              - generic [ref=f1e529]:
                - generic [ref=f1e530]:
                  - generic [ref=f1e531]: AC
                  - generic [ref=f1e532]:
                    - paragraph [ref=f1e533]: Acme Corporation
                    - paragraph [ref=f1e534]: David Park
                - button [ref=f1e535] [cursor=pointer]
              - generic [ref=f1e540]:
                - generic [ref=f1e541]:
                  - paragraph [ref=f1e542]: Status
                  - text: Active
                - generic [ref=f1e543]:
                  - paragraph [ref=f1e544]: Deal Value
                  - paragraph [ref=f1e545]: $48,000
              - generic [ref=f1e546]:
                - paragraph [ref=f1e547]: Pipeline Stage
                - paragraph [ref=f1e558]: Negotiation
              - generic [ref=f1e559]:
                - paragraph [ref=f1e560]: Activity
                - generic [ref=f1e561]:
                  - generic [ref=f1e562]:
                    - generic [ref=f1e565]: Discovery call — 45 min
                    - generic [ref=f1e566]: 3d ago
                  - generic [ref=f1e567]:
                    - generic [ref=f1e571]: Proposal deck sent
                    - generic [ref=f1e572]: 2h ago
                  - generic [ref=f1e573]:
                    - generic [ref=f1e577]: Follow-up scheduled
                    - generic [ref=f1e578]: Tomorrow
    - generic [ref=f1e581]:
      - generic [ref=f1e583]:
        - generic [ref=f1e584]:
          - generic [ref=f1e585]: Team
          - generic [ref=f1e592]: 32 members · 6 departments
        - generic [ref=f1e593]:
          - generic [ref=f1e594]:
            - generic [ref=f1e595]:
              - generic [ref=f1e596]: Engineering
              - generic [ref=f1e599]: 12 members
            - generic [ref=f1e600]:
              - generic [ref=f1e601]:
                - generic [ref=f1e602]: A
                - generic [ref=f1e605]:
                  - generic [ref=f1e606]:
                    - generic [ref=f1e607]: Alex R.
                    - generic [ref=f1e608]: Lead Dev
                  - generic [ref=f1e609]: API optimisation
              - generic [ref=f1e613]:
                - generic [ref=f1e614]: M
                - generic [ref=f1e617]:
                  - generic [ref=f1e618]:
                    - generic [ref=f1e619]: Mia C.
                    - generic [ref=f1e620]: Frontend
                  - generic [ref=f1e621]: Dashboard redesign
              - generic [ref=f1e625]:
                - generic [ref=f1e626]: T
                - generic [ref=f1e629]:
                  - generic [ref=f1e630]:
                    - generic [ref=f1e631]: Tom L.
                    - generic [ref=f1e632]: DevOps
                  - generic [ref=f1e633]: CI pipeline fix
          - generic [ref=f1e637]:
            - generic [ref=f1e638]:
              - generic [ref=f1e639]: Design
              - generic [ref=f1e642]: 6 members
            - generic [ref=f1e643]:
              - generic [ref=f1e644]:
                - generic [ref=f1e645]: S
                - generic [ref=f1e648]:
                  - generic [ref=f1e649]:
                    - generic [ref=f1e650]: Sara J.
                    - generic [ref=f1e651]: Product Designer
                  - generic [ref=f1e652]: Onboarding flow
              - generic [ref=f1e656]:
                - generic [ref=f1e657]: J
                - generic [ref=f1e660]:
                  - generic [ref=f1e661]:
                    - generic [ref=f1e662]: Jake M.
                    - generic [ref=f1e663]: Brand
                  - generic [ref=f1e664]: Brand update
      - generic [ref=f1e668]:
        - generic [ref=f1e669]: Team Management
        - heading "Know your people. Align the work." [level=2] [ref=f1e670]: Know your people.Align the work.
        - paragraph [ref=f1e671]: See who is working on what, across every department. Workload visibility, roles, status and active projects — all in one place.
        - list [ref=f1e672]:
          - listitem [ref=f1e673]: Departments, roles & permissions
          - listitem [ref=f1e675]: Live workload & status
          - listitem [ref=f1e677]: Member profiles & skills
          - listitem [ref=f1e679]: Cross-team project visibility
    - generic [ref=f1e682]:
      - generic [ref=f1e683]:
        - heading "From conversation to completion." [level=2] [ref=f1e684]
        - paragraph [ref=f1e685]: One idea becomes a chat, a task, a meeting and an outcome — all tracked in the same workspace.
      - generic [ref=f1e686]:
        - generic [ref=f1e692]:
          - generic [ref=f1e697]:
            - paragraph [ref=f1e698]: Step 1
            - paragraph [ref=f1e699]: Chat
          - generic [ref=f1e700]:
            - generic [ref=f1e701]: "#product"
            - generic [ref=f1e706]:
              - generic [ref=f1e707]: SR
              - paragraph [ref=f1e709]: "\"Let's finish the onboarding redesign before launch.\""
        - generic [ref=f1e715]:
          - generic [ref=f1e721]:
            - paragraph [ref=f1e722]: Step 2
            - paragraph [ref=f1e723]: Task
          - generic [ref=f1e724]:
            - generic [ref=f1e725]:
              - generic [ref=f1e726]: New Task
              - generic [ref=f1e727]: High
            - paragraph [ref=f1e728]: Finish onboarding redesign
            - generic [ref=f1e729]:
              - generic [ref=f1e730]: → Onboarding Project
              - generic [ref=f1e731]: Due Friday
        - generic [ref=f1e737]:
          - generic [ref=f1e743]:
            - paragraph [ref=f1e744]: Step 3
            - paragraph [ref=f1e745]: Meeting
          - generic [ref=f1e746]:
            - generic [ref=f1e747]:
              - generic [ref=f1e748]: LIVE
              - generic [ref=f1e751]: Design Review
            - generic [ref=f1e752]:
              - generic [ref=f1e753]: SR
              - generic [ref=f1e754]: AR
              - generic [ref=f1e755]: MC
        - generic [ref=f1e757]:
          - generic [ref=f1e763]:
            - paragraph [ref=f1e764]: Step 4
            - paragraph [ref=f1e765]: Tavro AI Summary
          - generic [ref=f1e766]:
            - generic [ref=f1e767]: Tavro AI Summary
            - list [ref=f1e772]:
              - listitem [ref=f1e773]: ✓ Redesign approved
              - listitem [ref=f1e774]: 3 tasks created
              - listitem [ref=f1e775]: 1 Acme demo scheduled
      - generic [ref=f1e776]:
        - generic [ref=f1e777]:
          - heading "Calendar → Meeting → Team" [level=3] [ref=f1e779]
          - generic [ref=f1e782]:
            - generic [ref=f1e783]:
              - paragraph [ref=f1e787]: Schedule
              - paragraph [ref=f1e788]: Design Review
            - generic [ref=f1e791]:
              - paragraph [ref=f1e796]: Meeting
              - paragraph [ref=f1e797]: Shared room
            - generic [ref=f1e800]:
              - paragraph [ref=f1e807]: Team
              - paragraph [ref=f1e808]: People together
        - generic [ref=f1e809]:
          - heading "Automation" [level=3] [ref=f1e811]
          - generic [ref=f1e814]:
            - generic [ref=f1e815]:
              - paragraph [ref=f1e819]: Trigger
              - paragraph [ref=f1e820]: CRM follow-up due
            - generic [ref=f1e823]:
              - paragraph [ref=f1e829]: Workflow
              - paragraph [ref=f1e830]: Create task reminder
            - generic [ref=f1e833]:
              - paragraph [ref=f1e838]: Result
              - paragraph [ref=f1e839]: Team stays on track
    - generic [ref=f1e842]:
      - generic [ref=f1e843]:
        - generic [ref=f1e844]: Tasks & Projects
        - heading "Know what needs to happen next." [level=2] [ref=f1e845]
        - paragraph [ref=f1e846]: Kanban boards, project milestones, priorities and assignments — with real-time updates so every team member sees the same picture.
        - list [ref=f1e847]:
          - listitem [ref=f1e848]: Kanban and list views
          - listitem [ref=f1e852]: Project milestones and progress
          - listitem [ref=f1e856]: Priority, assignee and due dates
          - listitem [ref=f1e860]: Linked to CRM and meetings
      - generic [ref=f1e865]:
        - generic [ref=f1e866]:
          - generic [ref=f1e867]: Onboarding Project
          - generic [ref=f1e872]:
            - generic [ref=f1e873]: 8 tasks
            - generic [ref=f1e876]: 62%
        - 'generic "Task pipeline: To Do, In Progress, Review, Done" [ref=f1e877]':
          - generic [ref=f1e879]: To Do
          - generic [ref=f1e882]: In Progress
          - generic [ref=f1e885]: Review
          - generic [ref=f1e888]: Done
        - generic [ref=f1e892]:
          - generic [ref=f1e893]:
            - generic [ref=f1e894]:
              - generic [ref=f1e896]: To Do
              - generic [ref=f1e897]: "2"
            - generic [ref=f1e898]:
              - generic [ref=f1e899]:
                - paragraph [ref=f1e900]: Write Q4 proposal
                - text: High
              - generic [ref=f1e901]:
                - paragraph [ref=f1e902]: Update docs
                - text: Normal
          - generic [ref=f1e903]:
            - generic [ref=f1e904]:
              - generic [ref=f1e906]: In Progress
              - generic [ref=f1e907]: "2"
            - generic [ref=f1e908]:
              - generic [ref=f1e909]:
                - paragraph [ref=f1e910]: Onboarding redesign
                - text: High
              - generic [ref=f1e911]:
                - paragraph [ref=f1e912]: API review
                - text: Normal
          - generic [ref=f1e913]:
            - generic [ref=f1e914]:
              - generic [ref=f1e916]: Review
              - generic [ref=f1e917]: "1"
            - generic [ref=f1e919]:
              - paragraph [ref=f1e920]: Acme demo deck
              - text: Urgent
          - generic [ref=f1e921]:
            - generic [ref=f1e922]:
              - generic [ref=f1e924]: Done
              - generic [ref=f1e925]: "1"
            - generic [ref=f1e927]:
              - paragraph [ref=f1e928]: Contract signed
              - text: High
    - region [ref=f1e929]:
      - generic [ref=f1e931]:
        - group "Tavro AI turns a user request into workspace actions" [ref=f1e933]:
          - generic [ref=f1e934]:
            - generic [ref=f1e935]: Workspace assistance
            - generic [ref=f1e936]: Context connected
          - generic [ref=f1e938]:
            - generic [ref=f1e939]:
              - generic [ref=f1e940]: You
              - paragraph [ref=f1e943]: Summarize today's meetings.
            - generic [ref=f1e946]:
              - generic [ref=f1e947]: Tavro AI
              - paragraph [ref=f1e951]: Understands your tasks, CRM, calendar, and team activity.
            - generic [ref=f1e954]:
              - generic [ref=f1e955]: Actions & results
              - paragraph [ref=f1e959]: "3 tasks need review before sprint ends Friday. The #engineering meeting produced 5 action items."
        - generic [ref=f1e960]:
          - generic [ref=f1e961]: AI Intelligence
          - heading "Work doesn't just happen. It gets smarter." [level=2] [ref=f1e966]:
            - text: Work doesn't just happen.
            - generic [ref=f1e967]: It gets smarter.
          - paragraph [ref=f1e968]: Tavro AI is built into WorkGrind to understand your workspace and help your team focus on what matters most — every single day.
          - link "Try Tavro AI" [ref=f1e969] [cursor=pointer]:
            - /url: /ai
    - region [ref=f1e972]:
      - generic [ref=f1e974]:
        - generic [ref=f1e975]:
          - generic [ref=f1e976]: Security
          - heading "Built for serious work." [level=2] [ref=f1e980]
          - paragraph [ref=f1e981]: Workspace isolation, role-based access and audit logging — baked in from day one.
          - img "Security flow with role-based access, an isolated workspace, and an audit trail" [ref=f1e982]:
            - generic [ref=f1e983]: Protected workspace data flow
            - generic [ref=f1e986]:
              - generic [ref=f1e987]:
                - paragraph [ref=f1e994]: Role access
                - paragraph [ref=f1e995]: Permission checks
              - generic [ref=f1e997]:
                - paragraph [ref=f1e1002]: Workspace
                - paragraph [ref=f1e1003]: Isolated data
              - generic [ref=f1e1005]:
                - paragraph [ref=f1e1010]: Audit trail
                - paragraph [ref=f1e1011]: Actions recorded
        - generic [ref=f1e1012]:
          - generic [ref=f1e1013]:
            - heading "Role-Based Access" [level=3] [ref=f1e1020]
            - paragraph [ref=f1e1021]: Owner, Admin, Manager and Employee roles with clear permission boundaries.
          - generic [ref=f1e1022]:
            - heading "Workspace Isolation" [level=3] [ref=f1e1026]
            - paragraph [ref=f1e1027]: Each workspace is fully isolated — no cross-tenant data exposure.
          - generic [ref=f1e1028]:
            - heading "Secure Authentication" [level=3] [ref=f1e1033]
            - paragraph [ref=f1e1034]: JWT with refresh rotation and bcrypt password hashing.
          - generic [ref=f1e1035]:
            - heading "Audit Logs" [level=3] [ref=f1e1040]
            - paragraph [ref=f1e1041]: Every privileged action logged with actor, resource and timestamp.
    - region "Get started with WorkGrind" [ref=f1e1042]:
      - generic [ref=f1e1044]:
        - generic [ref=f1e1045]: Start Your 7-Day Free Trial
        - heading "Your team's new home for work." [level=2] [ref=f1e1048]:
          - text: Your team's new home
          - generic [ref=f1e1049]: for work.
        - paragraph [ref=f1e1050]: Bring conversations, meetings, projects and ideas together with WorkGrind. Start your 7-day free trial — no long-term commitment.
        - generic [ref=f1e1051]:
          - link "Start Building Better" [ref=f1e1052] [cursor=pointer]:
            - /url: /signup
          - button "Explore the Workspace" [ref=f1e1055] [cursor=pointer]
        - 'img "WorkGrind ecosystem: CRM, Team, Tasks, Meetings, and Tavro AI" [ref=f1e1056]':
          - generic [ref=f1e1057]:
            - generic [ref=f1e1059]: CRM
            - generic [ref=f1e1066]: Team
            - generic [ref=f1e1074]: Tasks
            - generic [ref=f1e1080]: Meetings
            - generic [ref=f1e1085]: Tavro AI
        - generic [ref=f1e1091]:
          - generic [ref=f1e1092]: 7-day free trial
          - generic [ref=f1e1094]: No long-term commitment
          - generic [ref=f1e1096]: Set up in minutes
          - generic [ref=f1e1098]: Full workspace access
    - contentinfo [ref=f1e1100]:
      - generic [ref=f1e1101]:
        - generic [ref=f1e1102]:
          - generic [ref=f1e1103]:
            - img "WorkGrind" [ref=f1e1104]:
              - generic [aria-hidden] [ref=f1e1108]:
                - generic [ref=f1e1109]: Work
                - generic [ref=f1e1110]: Grind
            - paragraph [ref=f1e1111]: One intelligent workspace for modern teams.
            - link "Follow WorkGrind on Instagram" [ref=f1e1113] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
            - paragraph [ref=f1e1118]: © 2026 WorkGrind. All rights reserved.
          - generic [ref=f1e1119]:
            - heading "Company" [level=3] [ref=f1e1120]
            - list [ref=f1e1121]:
              - listitem [ref=f1e1122]:
                - link "About" [ref=f1e1123] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=f1e1124]:
                - link "Features" [ref=f1e1125] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=f1e1126]:
                - link "Demo" [ref=f1e1127] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=f1e1128]:
                - link "Contact" [ref=f1e1129] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=f1e1130]:
            - heading "Legal" [level=3] [ref=f1e1131]
            - list [ref=f1e1132]:
              - listitem [ref=f1e1133]:
                - link "Privacy Policy" [ref=f1e1134] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=f1e1135]:
                - link "Terms of Service" [ref=f1e1136] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=f1e1137]:
                - link "Cookie Preferences" [ref=f1e1138] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=f1e1139]:
                - link "Refund Policy" [ref=f1e1140] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=f1e1141]:
                - link "Cancellation Policy" [ref=f1e1142] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=f1e1143]:
                - link "Disclaimer" [ref=f1e1144] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=f1e1145]:
            - heading "Trust & Security" [level=3] [ref=f1e1146]
            - list [ref=f1e1147]:
              - listitem [ref=f1e1148]:
                - link "Security" [ref=f1e1149] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=f1e1150]:
                - link "Responsible Disclosure" [ref=f1e1151] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=f1e1152]:
                - link "Accessibility" [ref=f1e1153] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=f1e1154]:
                - link "Data Processing Agreement" [ref=f1e1155] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=f1e1156]:
                - link "Acceptable Use" [ref=f1e1157] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=f1e1158]:
                - link "Community Guidelines" [ref=f1e1159] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=f1e1160]:
            - heading "Support" [level=3] [ref=f1e1161]
            - list [ref=f1e1162]:
              - listitem [ref=f1e1163]:
                - link "Help Center" [ref=f1e1164] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=f1e1165]:
                - link "Support" [ref=f1e1166] [cursor=pointer]:
                  - /url: /support
        - generic [ref=f1e1167]:
          - paragraph [ref=f1e1168]: 7-day free trial · No long-term commitment · Built for modern teams
          - button "Select language" [ref=f1e1170] [cursor=pointer]:
            - generic [ref=f1e1174]: English
  - alert [ref=f1e1177]
```

# Test source

```ts
  155 |       .filter((src) => {
  156 |         try {
  157 |           return new URL(src).origin === location.origin;
  158 |         } catch {
  159 |           return false;
  160 |         }
  161 |       }))]
  162 |   );
  163 |   const secretMarkers: string[] = [];
  164 |   for (const src of scripts) {
  165 |     try {
  166 |       const scriptResponse = await page.request.get(src, { timeout: 10_000 });
  167 |       const scriptText = await scriptResponse.text();
  168 |       const marker = scriptText.match(
  169 |         /(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|mongodb(?:\+srv)?:\/\/[^\s"'<>]{10,})/
  170 |       );
  171 |       if (marker) secretMarkers.push(`${safeUrl(src)} (${marker[0].startsWith('mongodb') ? 'database URI' : 'key/token marker'})`);
  172 |     } catch {
  173 |       // The browser network audit records failed resource requests separately.
  174 |     }
  175 |   }
  176 |   const unlabeledButtons = await page.locator('button').evaluateAll((buttons) =>
  177 |     buttons
  178 |       .filter((button) => {
  179 |         const hasName =
  180 |           button.textContent?.trim() ||
  181 |           button.getAttribute('aria-label') ||
  182 |           button.getAttribute('title') ||
  183 |           button.querySelector('img[alt], svg[aria-label], [aria-labelledby]');
  184 |         return !hasName;
  185 |       })
  186 |       .map((button) => button.outerHTML.slice(0, 240))
  187 |   );
  188 |   const oldBrandMatches = pageText
  189 |     .split(/\r?\n/)
  190 |     .map((line) => line.trim())
  191 |     .filter((line) => oldBrandPattern.test(line))
  192 |     .map((line) => safeText(line).slice(0, 240));
  193 | 
  194 |   return {
  195 |     response,
  196 |     elapsedMs,
  197 |     status: response?.status() ?? null,
  198 |     securityHeaders: response ? await response.allHeaders() : {},
  199 |     title,
  200 |     pageText,
  201 |     imageFailures,
  202 |     overflow,
  203 |     emptyLinks,
  204 |     brokenInternalLinks,
  205 |     secretMarkers,
  206 |     unlabeledButtons,
  207 |     oldBrandMatches,
  208 |     runtimeIssues: runtime.issues,
  209 |     stopTracking: runtime.stop,
  210 |   };
  211 | }
  212 | 
  213 | test.describe('WorkGrind public-site audit', () => {
  214 |   for (const path of publicPaths) {
  215 |     test(`public page ${path}`, async ({ page }) => {
  216 |       const audit = await inspectPage(page, path);
  217 |       expect(audit.response, `${path} navigation returned no HTTP response`).not.toBeNull();
  218 |       expect(audit.response!.status(), `${path} navigation status`).toBeLessThan(400);
  219 |       expect(audit.title, `${path} should have a document title`).toBeTruthy();
  220 |       expect(audit.pageText.trim().length, `${path} should render visible content`).toBeGreaterThan(20);
  221 |       const issues = [
  222 |         ...audit.imageFailures.map((item) => `Broken image: ${item}`),
  223 |         ...(audit.overflow.scrollWidth > audit.overflow.clientWidth + 2
  224 |           ? [`Horizontal overflow: ${audit.overflow.scrollWidth}px content / ${audit.overflow.clientWidth}px viewport`]
  225 |           : []),
  226 |         ...audit.emptyLinks.map((item) => `Link without destination: ${item}`),
  227 |         ...audit.brokenInternalLinks.map((item) => `Broken internal link: ${item}`),
  228 |         ...audit.secretMarkers.map((item) => `Potential secret exposed in client bundle: ${item}`),
  229 |         ...audit.unlabeledButtons.map((item) => `Button without accessible name: ${safeText(item)}`),
  230 |         ...audit.oldBrandMatches.map((item) => `Old-brand text: ${item}`),
  231 |         ...audit.runtimeIssues,
  232 |       ];
  233 |       await test.info().attach('page-audit.json', {
  234 |         body: JSON.stringify({
  235 |           url: safeUrl(page.url()),
  236 |           path,
  237 |           status: audit.status,
  238 |           contentSecurityPolicy: Boolean(audit.securityHeaders['content-security-policy']),
  239 |           strictTransportSecurity: Boolean(audit.securityHeaders['strict-transport-security']),
  240 |           setCookieAttributes: (audit.securityHeaders['set-cookie'] || '')
  241 |             .split(/,(?=[^;]+=[^;]+)/)
  242 |             .filter(Boolean)
  243 |             .map((cookie) => ({
  244 |               secure: /;\s*secure\b/i.test(cookie),
  245 |               httpOnly: /;\s*httponly\b/i.test(cookie),
  246 |               sameSite: cookie.match(/;\s*samesite=([^;]+)/i)?.[1] || null,
  247 |             })),
  248 |           title: safeText(audit.title),
  249 |           elapsedMs: audit.elapsedMs,
  250 |           issues,
  251 |           oldBrandMatches: audit.oldBrandMatches,
  252 |         }, null, 2),
  253 |         contentType: 'application/json',
  254 |       });
> 255 |       expect(issues, `${path} audit issues`).toEqual([]);
      |                                              ^ Error: / audit issues
  256 |       test.info().annotations.push({ type: 'navigation-ms', description: String(audit.elapsedMs) });
  257 |       audit.stopTracking();
  258 |     });
  259 |   }
  260 | });
  261 | 
  262 | test('responsive layouts on key public pages', async ({ page }) => {
  263 |   const issues: string[] = [];
  264 |   for (const viewport of [
  265 |     { name: 'desktop', width: 1440, height: 900 },
  266 |     { name: 'laptop', width: 1280, height: 720 },
  267 |     { name: 'tablet', width: 768, height: 1024 },
  268 |     { name: 'mobile', width: 390, height: 844 },
  269 |   ]) {
  270 |     await page.setViewportSize({ width: viewport.width, height: viewport.height });
  271 |     for (const path of ['/', '/pricing', '/signup', '/login']) {
  272 |       try {
  273 |         await page.goto(path, { waitUntil: 'domcontentloaded' });
  274 |         const sizes = await page.evaluate(() => ({
  275 |           body: document.body.scrollWidth,
  276 |           viewport: document.documentElement.clientWidth,
  277 |         }));
  278 |         if (sizes.body > sizes.viewport + 2) {
  279 |           issues.push(`${viewport.name} ${path}: ${sizes.body}px content exceeds ${sizes.viewport}px viewport`);
  280 |         }
  281 |       } catch (error) {
  282 |         issues.push(`${viewport.name} ${path}: ${error instanceof Error ? error.message : 'navigation failed'}`);
  283 |       }
  284 |     }
  285 |   }
  286 |   await test.info().attach('responsive-audit.json', {
  287 |     body: JSON.stringify({ issues }, null, 2),
  288 |     contentType: 'application/json',
  289 |   });
  290 |   expect(issues).toEqual([]);
  291 | });
  292 | 
  293 | test('login form exposes required email/password fields and blocks empty submission', async ({ page }) => {
  294 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  295 |   const email = page.locator('input[type="email"]');
  296 |   const password = page.locator('input[type="password"]');
  297 |   await expect(email).toHaveCount(1);
  298 |   await expect(password).toHaveCount(1);
  299 |   await expect(page.locator('button[type="submit"]')).toHaveCount(1);
  300 |   expect(await email.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  301 |   expect(await password.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  302 |   await page.locator('button[type="submit"]').click();
  303 |   expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  304 |   expect(new URL(page.url()).pathname).toBe('/login');
  305 | });
  306 | 
  307 | test('protected application routes redirect unauthenticated visitors', async ({ page }) => {
  308 |   const results: Array<{ path: string; status: number | null; landedAt: string }> = [];
  309 |   const issues: string[] = [];
  310 |   for (const path of authenticatedPaths) {
  311 |     try {
  312 |       const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  313 |       await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  314 |       const landedAt = new URL(page.url()).pathname;
  315 |       results.push({ path, status: response?.status() ?? null, landedAt });
  316 |       if (!/\/login\/?$/.test(landedAt)) issues.push(`${path} resolved to ${landedAt}, not login`);
  317 |     } catch (error) {
  318 |       issues.push(`${path}: ${error instanceof Error ? safeText(error.message) : 'navigation failed'}`);
  319 |       results.push({ path, status: null, landedAt: safeUrl(page.url()) });
  320 |     }
  321 |   }
  322 |   await test.info().attach('protected-route-audit.json', {
  323 |     body: JSON.stringify({ results, issues }, null, 2),
  324 |     contentType: 'application/json',
  325 |   });
  326 |   expect(issues).toEqual([]);
  327 | });
  328 | 
  329 | test('authenticated routes and read-only feature audit', async ({ page }) => {
  330 |   const email = process.env.WORKGRIND_TEST_EMAIL;
  331 |   const password = process.env.WORKGRIND_TEST_PASSWORD;
  332 |   test.skip(!email || !password, 'Set WORKGRIND_TEST_EMAIL and WORKGRIND_TEST_PASSWORD in the environment to run authenticated checks.');
  333 | 
  334 |   const loginRuntime = trackRuntime(page);
  335 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  336 |   await page.locator('input[type="email"]').fill(email!);
  337 |   await page.locator('input[type="password"]').fill(password!);
  338 |   await page.locator('button[type="submit"]').click();
  339 |   await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });
  340 | 
  341 |   const storageState = await page.evaluate(() =>
  342 |     Object.keys(localStorage).map((name) => name.toLowerCase())
  343 |   );
  344 |   const cookies = await page.context().cookies();
  345 |   const authEvidence = {
  346 |     redirectedTo: safeUrl(page.url()),
  347 |     storageKeyNames: storageState.filter((name) => /auth|token|session/.test(name)),
  348 |     cookies: cookies
  349 |       .filter((cookie) => /auth|token|session/i.test(cookie.name))
  350 |       .map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite })),
  351 |   };
  352 |   test.info().annotations.push({
  353 |     type: 'session-evidence',
  354 |     description: JSON.stringify(authEvidence),
  355 |   });
```