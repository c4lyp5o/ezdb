# Changelog

Versions follow Semantic Versioning. Entries describe implemented changes, not publication status.

## Unreleased — 1.0.0

### Added

- PostgreSQL public-schema table and MongoDB collection browsing with pagination.
- Database credential login, isolated in-memory sessions, idle expiry and disconnect.
- Individual record creation, typed partial editing and confirmed deletion.
- Canonical MongoDB Extended JSON with BSON fidelity and typed record keys.
- Dark ez-series workspace, self-hosted Public Sans, responsive layout and shared footer.
- Actual login/CRUD browser coverage, dialog keyboard checks and read-only database permission tests.
- Non-root multi-stage Docker packaging; test-gated GitHub Actions and GHCR publishing configuration.
- MIT license, contributor/security guidance and canonical agent instructions.

### Security

- Bound SQL values and quoted identifiers; primary keys required for PostgreSQL edits/deletes.
- HttpOnly SameSite session cookies, cross-origin mutation rejection and redacted unexpected errors.
- Localhost listener by default. Private administration only; no public-internet security certification.

### Known limits

- PostgreSQL public schema only; MongoDB authentication uses admin.
- No arbitrary queries, schema changes, bulk edits, field removal, MySQL or SQLite.
- Mobile data grids scroll horizontally. Physical-phone testing and exhaustive database-type coverage remain unverified.
