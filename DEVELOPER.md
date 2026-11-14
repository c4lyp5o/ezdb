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
