# Education module implementation plan

## Audit summary

WorkGrind already contains a tenant-scoped academic domain: academic people,
departments, courses, classes, enrollments, guardian links, teaching
assignments, schedules, assignments, attendance, assessments, results, and
offline fee charges. The `/academic` page supports administrator CRUD and a
restricted student, teacher, and parent portal. Workspace classification,
role catalogs, department scope checks, fee amount validation, atomic payment
recording, and audit logging are already implemented.

The main product gaps found during the audit are:

- Education navigation is one long undifferentiated list rather than grouped
  by the institution workflow.
- School, college, and university context is mainly represented by workspace
  type and role labels; the page needs clearer institution context without
  introducing unsupported domain concepts.
- Timetable creation and editing validate time syntax but do not reject
  overlapping sessions for the same class or room.
- The current implementation intentionally does not include submissions,
  published/finalized results, transcripts, announcements, fee structures,
  refunds, or payment gateway processing because those models and services do
  not exist.

## Delivery phases and acceptance criteria

1. **Navigation and experience foundation**
   - Group supported education sections into Overview, People, Academics,
     Academic Operations, Finance, and Administration.
   - Keep section visibility driven by workspace type, role, and existing
     capabilities.
   - Show the persisted institution type in the academic header.

2. **Academic integrity fixes**
   - Reject overlapping timetable sessions for the same class.
   - Reject overlapping use of the same named room when a room is supplied.
   - Apply the same checks to create and edit operations, scoped by tenant and
     effective date range.
   - Preserve existing records and return actionable conflict responses.

3. **Verification and regression safety**
   - Add backend regression coverage for timetable conflicts.
   - Run academic backend tests, frontend TypeScript checks, the focused
     Playwright academic suite, lint, and production builds where the local
     environment permits.
   - Report blocked checks separately from passing checks.

## Explicit supported-scope boundary

Fee records are offline bookkeeping and use integer minor currency units.
Students, guardians, teachers, and portal users remain restricted to the
tenant and relationships already enforced by the backend. Features without a
persisted model or supported service remain hidden rather than simulated.
