# Education bulk import audit and scope

## Existing architecture

- Education data is stored in tenant-scoped Mongoose models under
  `backend/src/models/Academic*.ts`.
- `/api/academic` is protected by authentication, education-workspace checks,
  administrator authorization, and department scoping for Deans and HODs.
- Academic mutations already validate cross-record ownership and write audit
  records through `AuditLog`.
- File uploads use memory-backed Multer with extension, MIME, content-signature,
  and size checks. There was no spreadsheet parsing or import-job model.
- The frontend already includes `exceljs` and uses the Education page as the
  administration surface.
- Google OAuth exists for sign-in and YouTube/social publishing only. No Sheets
  OAuth scope, spreadsheet reader, sync model, or scheduled job exists.

## Implemented import boundary

The import workflow uses a server-side ExcelJS parser and the existing academic
tenant/role guards. It supports CSV and `.xlsx`; legacy `.xls` is rejected
because the current safe parser does not support it. Each import is limited to
10,000 data rows and 50 MB, ignores explicit template comment rows beginning
with `#`, rejects formula cells, validates headers and relationships, and
stores only sanitized row-level errors in import history.

Supported modules use stable keys rather than names alone: external IDs for
people, codes for departments/courses, compound academic class identity,
tenant-owned IDs or stable related identifiers for academic operations, and
invoice numbers for fees. Parent links are never inferred from names.

Google Sheets is intentionally not enabled in this slice. Adding a Sheets
provider to the existing social-publishing Integration model would conflate
unrelated OAuth permissions. A dedicated least-privilege Sheets OAuth flow and
sync model are required before that phase can be implemented safely.
