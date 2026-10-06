# WorkGrind — All-in-One Business Workspace

WorkGrind is a modern, enterprise-ready digital workspace that brings together the essential tools businesses and teams need to **work, communicate, manage projects, collaborate with clients, automate workflows, and grow** — all from one connected platform.

WorkGrind combines capabilities inspired by modern tools such as Slack, Microsoft Teams, Zoom, Trello/Asana, Google Drive, and Notion into a unified SaaS workspace.

> **Status: Coming Soon**

---

## 🌟 Core Modules & Features

### 1. 🔐 Authentication & Multi-Tenant Workspaces

WorkGrind provides secure authentication and isolated multi-tenant workspaces.

* JWT access & refresh token rotation
* Secure bcrypt password hashing
* Email verification
* Password reset
* Mobile number verification with OTP
* Google Sign-In
* Apple Sign-In
* Secure OAuth/OIDC account linking
* Company/workspace onboarding
* Workspace invitation links
* Multi-tenant data isolation
* Role-Based Access Control

### Workspace Roles

Workspaces support five primary roles:

* `Owner`
* `Admin`
* `Manager`
* `Employee`
* `Guest`

Existing email/password authentication remains available alongside social authentication.

---

## 2. 💬 Workplace Chat

A real-time communication system for teams.

* Public channels
* Private channels
* Direct messages
* Group conversations
* Real-time messaging
* Socket.io powered communication
* Emoji reactions
* Message threads
* Message editing
* Soft deletion
* Message pinning
* Online presence
* Typing indicators

---

## 3. 🎥 Meetings & Video Conferencing

WorkGrind includes integrated meetings for internal and external collaboration.

### Meeting Features

* Scheduled meetings
* Instant meetings
* Persistent meeting links
* Cross-workspace meeting access
* Video/audio communication
* Microphone controls
* Camera controls
* Screen sharing
* Hand raising
* In-call chat
* Participant roster
* Meeting access controls

### 🤖 AI Meeting Assistant

Meeting intelligence can automatically help with:

* Meeting summaries
* Key discussion points
* Decisions
* Action items
* Converting action items into tasks

---

## 4. 📋 Task Management

Manage individual and workspace-wide work.

### Views

* My Tasks
* Workspace Tasks
* Kanban
* List

### Task Features

* To Do
* In Progress
* Review
* Completed
* Priority levels
* Due dates
* Checklists
* Subtasks
* Comments
* Task discussions
* Task assignments
* Slide-over task details

Project progress can automatically update based on task completion.

---

## 5. 🚀 Project Management

Plan and track projects from one place.

### Project Statuses

* `Planning`
* `Active`
* `On Hold`
* `Completed`

### Project Features

* Project roadmaps
* Milestones
* Deadlines
* Manager assignments
* Progress tracking
* Task integration
* Project activity
* Project-level collaboration

---

## 6. 📅 Workspace Calendar

A unified calendar connecting important workspace activity.

Calendar can display:

* Meetings
* Project deadlines
* Task due dates
* Company events
* Scheduled activities

Additional capabilities include:

* Month view
* Event creation
* Date/time selection
* Meeting link attachment
* Event management

---

## 7. 👥 CRM & Client Management

WorkGrind provides tools for managing customer relationships.

### CRM

* Companies
* Contacts
* Deals
* Customer information
* Company/project relationships
* Activity tracking
* Company 360 view

### Client Portal

Provide clients with controlled access to relevant workspace information.

Clients can interact with:

* Projects
* Requests
* Approvals
* Shared information
* Project updates

Client access remains isolated from internal workspace data.

---

## 8. ☁️ File Management

A workspace cloud-drive experience for business files.

* Folder hierarchy
* File uploads
* File previews
* Downloads
* Star/favorite files
* Soft deletion
* Workspace data isolation
* Storage quota tracking
* Storage usage indicator

Files remain isolated according to workspace permissions.

---

## 9. 📝 Collaborative Documents

A Notion-style collaborative document system.

Supports:

* Rich document editing
* Markdown
* Meeting notes
* SOPs
* Policies
* Workspace documentation
* Version history

### AI Document Tools

Tavro AI can assist with document-related workflows such as summarization and extracting useful information.

---

# 10. 🤖 Tavro AI

**Tavro AI** is WorkGrind's workspace-aware AI assistant.

Tavro can work with authorized WorkGrind information and assist users with business workflows.

### Capabilities

* Conversational AI
* Workspace-aware responses
* Task assistance
* Project assistance
* Meeting information
* Deliverable summaries
* Overdue item detection
* Sprint planning assistance
* Workspace insights
* AI-powered productivity workflows

Tavro AI is designed to respect existing authentication, permissions, workspace boundaries, and user entitlements.

AI provider failures should be handled gracefully without exposing internal errors to users.

---

# 11. 🔎 Global Search

Instantly search across the workspace.

Supported search areas include:

* People
* Tasks
* Projects
* Channels
* Messages
* Files
* Documents
* CRM records

Keyboard shortcut:

`Ctrl + K`

`⌘ + K`

---

# 12. 👤 Team Directory

A centralized team directory.

Team profiles can include:

* Avatar
* Name
* Role
* Department
* Skills
* Online status

Actions include:

* Direct Message
* Video Call
* Profile viewing
* Team invitations

Workspace admins can invite teammates through email.

---

# 13. 📞 Global Calling

WorkGrind provides cross-workspace calling capabilities using WorkGrind Calling IDs.

Features include:

* Calling IDs
* Incoming calls
* Outgoing calls
* Online availability
* Call presence
* Call notifications
* Cross-workspace calling
* Call session management
* Audio communication
* Meeting integration

Calling access and privacy are controlled through the authenticated WorkGrind account.

---

# 14. ⚙️ Automation

WorkGrind includes workflow automation capabilities for reducing repetitive work.

Automation can connect workspace events with actions such as:

* Task updates
* Project workflows
* Notifications
* Workspace processes
* Business actions

Automation is designed to work within existing workspace permissions.

---

# 15. 🧠 Analytics

Workspace analytics provide visibility into business activity.

Potential areas include:

* Project progress
* Task activity
* Team activity
* Workspace usage
* Storage usage
* Productivity indicators
* Business activity

Analytics respect workspace-level access permissions.

---

# 16. 👨‍💻 Developer & API Platform

WorkGrind provides a dedicated Developer section for integrations and API access.

Developer capabilities include:

* API key creation
* API key rotation
* API key revocation
* Secure key storage
* API documentation
* Integration support
* Webhook configuration

### API Security

API keys are:

* Securely generated
* Hashed before storage
* Revocable
* Rotatable
* Workspace-scoped
* Permission-controlled

Secret API keys should only be displayed to the user when they are initially generated.

The Developer section is separate from the normal WorkGrind workspace navigation.

---

# 17. 🔔 Notifications

WorkGrind provides centralized notifications for important workspace events.

Examples include:

* Task assignments
* Mentions
* Messages
* Meeting events
* Project updates
* Client requests
* Approvals
* System notifications

---

# 18. 💳 Billing & Subscriptions

WorkGrind supports subscription-based workspace plans.

Current plan structure:

### Free Trial

* 7-day premium trial
* Full premium functionality during trial
* 1 GB storage
* 50 AI requests/month
* Up to 5 members

### Starter

**$9/month**

* 10 GB storage
* 200 AI requests/month
* Up to 20 members

### Pro

**$19/month**

* 100 GB storage
* Unlimited AI requests
* Unlimited members

Subscription access and feature entitlements are enforced through the backend.

> Pricing and plan availability may change before the public launch.

---

# 🛡️ Security

WorkGrind is designed around secure multi-tenant architecture.

Security technologies include:

* JWT authentication
* Access/refresh token rotation
* bcrypt password hashing
* OAuth/OIDC authentication
* Role-Based Access Control
* Workspace data isolation
* API key hashing
* API key revocation
* Rate limiting
* Helmet
* Secure authentication middleware
* Protected API routes
* Input validation
* Secure file access
* Audit logging

Sensitive credentials and provider secrets must never be exposed to the frontend.

---

# 🛠 Technology Stack

## Frontend

* Next.js 14
* App Router
* React 18
* TypeScript
* Tailwind CSS
* Lucide React
* Zustand
* Axios
* Socket.io Client

## Backend

* Node.js
* Express
* TypeScript
* MongoDB
* Mongoose
* Socket.io
* JWT
* Multer
* Helmet
* Morgan
* Rate Limiting

## AI

* Google Gemini API
* Context-aware AI architecture
* Tavro AI
* Provider fallback handling

## Infrastructure

* Cloudflare services where applicable
* Object storage
* WebSocket communication
* REST API architecture

---

# 🚀 Running WorkGrind Locally

## 1. Backend

Open a terminal:

```bash
cd backend
npm install
npm run dev
```

Backend runs on:

```text
http://localhost:5000
```

The backend connects to MongoDB using the configured environment variables.

---

## 2. Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:3000
```

Open:

```text
http://localhost:3000
```

---

# 📞 Calling ID Backfill

For existing accounts that need permanent Calling IDs:

```bash
cd backend
npm run build
npm run calling-id:backfill
```

This is a one-time operation for accounts already present in the database.

---

# 🔑 Environment Configuration

Create the required environment files according to the existing frontend and backend configuration.

Typical backend configuration may include:

```env
PORT=5000
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

CLIENT_URL=http://localhost:3000

GEMINI_API_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=
```

Never commit real secrets to Git.

Use `.env.example` for safe placeholder values.

---

# 🔐 Authentication Flow

WorkGrind supports multiple authentication methods.

### Email & Password

```text
Signup
↓
Email verification
↓
Workspace onboarding
↓
Dashboard
```

### Mobile Verification

```text
Signup / Social Signup
↓
Phone number
↓
SMS verification code
↓
Phone verified
↓
Continue onboarding
```

### Google

```text
Continue with Google
↓
Google authentication
↓
WorkGrind verifies identity
↓
Existing account OR new account
↓
WorkGrind JWT session
↓
Dashboard / onboarding
```

### Apple

```text
Continue with Apple
↓
Apple authentication
↓
WorkGrind verifies identity
↓
Existing account OR new account
↓
WorkGrind JWT session
↓
Dashboard / onboarding
```

Google and Apple authentication use the existing WorkGrind authentication/session architecture rather than creating a separate session system.

---

# 🧪 Demo Accounts

For local testing, the database seeder may create the following demo organization:

**Apex Technologies**

| Name          | Role     | Email               | Password       |
| ------------- | -------- | ------------------- | -------------- |
| Sarah Jenkins | Owner    | `sarah@apextech.io` | `Password123!` |
| Alex Rivera   | Admin    | `alex@apextech.io`  | `Password123!` |
| Maya Lin      | Manager  | `maya@apextech.io`  | `Password123!` |
| Ali Khan      | Employee | `ali@apextech.io`   | `Password123!` |

> Demo credentials are for local development/testing only and must never be used as production credentials.

You can also register a new account and create a new workspace.

---

# 🧩 Project Structure

A simplified project structure:

```text
WorkGrind/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── stores/
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
```

---

# 🌐 Main Application Areas

WorkGrind's workspace experience includes:

```text
WORKSPACE
├── Overview
├── Daily Focus
├── Tasks
├── Projects
└── Calendar

CUSTOMERS
├── CRM
└── Client Portal

COLLABORATE
├── Chat
├── Meetings
├── Whiteboard
└── Docs

RESOURCES
├── Files
├── Analytics
└── Automation

INTELLIGENCE
└── Tavro AI

ADMIN
├── Team
├── Notifications
├── Billing
└── Settings
```

Additional platform areas include:

```text
Global Calling
Developer
API / Integrations
```

---

# 🎯 Product Philosophy

WorkGrind is designed around one principle:

> **Everything your team needs to work should feel connected.**

Instead of switching between multiple applications for communication, projects, customers, files, meetings, AI, and business operations, WorkGrind brings these workflows together inside one connected workspace.

The goal is to provide a platform that is:

* Fast
* Minimal
* Modern
* Secure
* Connected
* Scalable
* AI-assisted

---

# 🚧 Current Product Status

WorkGrind is currently under development and is **not publicly launched yet**.

Public marketing and product materials should use:

**Coming Soon**

and should not imply that WorkGrind is already available to the general public.

---

# 📄 License

WorkGrind is proprietary software.

All rights reserved.

The source code, product design, branding, business logic, and proprietary features belong to WorkGrind and may not be redistributed or commercially reused without permission.
