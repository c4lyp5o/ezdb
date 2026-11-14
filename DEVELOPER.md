# Developer notes

## Structure

- backend/app.js: Elysia API and built frontend serving.
- backend/postgres.js: public-schema metadata and bound-value PostgreSQL CRUD.
- backend/mongo.js: MongoDB CRUD with canonical Extended JSON.
- backend/sessions.js: in-memory connection ownership, idle expiry, periodic cleanup and shutdown.
- frontend/src/editor.js: pure typed JSON patch generation.
- frontend/src/App.jsx: connection form, browsing, pagination, editor and delete confirmation.
- tests/: Bun unit/integration tests and Python Playwright UI smoke suite.

Run commands and fixture requirements are in README.md. Vite outputs frontend/dist, served by the backend on the same origin. No passwords or connection strings belong in source or browser storage.

## Write semantics

Edits are patches, not document replacements. The editor hides primary keys and sends changed fields only; omitted fields are unchanged. Explicit null and empty strings are distinct. MongoDB uses canonical Extended JSON in both directions and disables driver value promotion while browsing. Hex strings are not coerced to ObjectIds. Dotted/operator top-level update names are refused.

PostgreSQL tables without primary keys are browse/insert only. MongoDB tables use _id. BSON dates, longs, decimals, doubles, integers, binary values and ObjectId/string ID collisions have integration coverage. Empty PostgreSQL inserts request DEFAULT VALUES.

## Verification and limits

Bun tests use isolated ezdb_test databases, not production. The UI smoke suite submits the actual login form with isolated fixture credentials, then drives browser controls at 1280px and 390px widths, verifies database readback, keyboard focus and Escape cancellation, page errors and document overflow, and captures screenshots.

No schema changes, arbitrary queries, bulk editing or field deletion. PostgreSQL public schema only; MongoDB totals are estimated. Mobile tables intentionally scroll horizontally. Session metadata restores on reload, never credentials. Cross-origin writes are rejected; validation and unexpected driver errors are redacted.

Use only on localhost or a trusted private network with least-privilege users. Connection/rate quotas, exhaustive database-type coverage and a full security audit remain future hardening work; do not expose this service directly to the public internet.

## MySQL and uploaded SQLite

MySQL tables now support browsing, pagination and record CRUD using database permissions. SQLite accepts standalone database uploads (32 MiB maximum); no server path or environment configuration is needed. Uploading requires explicit acknowledgement that the entire database is sent to a trusted server/operator. Use an offline backup, not a live WAL file.

Uploaded files are private per session, use generated storage names, and are removed on disconnect or 30 idle minutes. A fixed 24-hour deadline is enforced independently of activity; a 30-second cleanup sweep and startup sweep remove expired files and SQLite sidecars. If the server is stopped, cleanup resumes at startup. Operator backups/forensic erasure cannot be guaranteed. Download the edited copy before leaving; the original local file is not changed. Primary keys are required for individual SQL edits/deletes. No raw SQL console is exposed.

CI uses Ubuntu 24.04 and updated Node 24-based Actions, with isolated MySQL 8.4 integration fixtures.
