# Agent guide

## Objective and structure

A small private database browser, not a query IDE. PostgreSQL public-schema tables, MySQL/MariaDB tables, uploaded SQLite databases and MongoDB collections; individual record CRUD only. See README.md and DEVELOPER.md.

- backend/: Elysia API, adapters, sessions and same-origin assets.
- frontend/: React + Vite + Tailwind 4; shared ez tokens from ezjot/ezups/ezconv.
- tests/: Bun tests and Python Playwright smoke checks.

## Conventions

Use Bun 1.4.4, ESM, tabs, double quotes, semicolons and Biome. Keep changes modular and minimal. Preserve canonical BSON types and typed keys; never coerce hex string IDs to ObjectIds. Updates send changed fields only. Database permissions remain the authorization boundary.

## Safety and verification

Never store/log credentials, add saved passwords, or access production databases for tests. Integration tests are destructive and fixed to isolated loopback ezdb_test instances. Use environment credentials, never literals. Preserve loopback defaults, HttpOnly sessions, cross-origin mutation rejection, redacted errors and explicit delete confirmation.

Run bun run lint, bun run typecheck, bun test and bun run build. For UI changes run tests/ui-smoke.py against a fresh built server with Python Playwright. Test actual login, CRUD, keyboard controls and 1280/390px layouts. A skipped or unrun check is not passing evidence. See DEVELOPER.md for setup.

Update README/CHANGELOG when behavior changes. Version comes from package.json; tags must match. No commits, pushes, tags, releases or deployments without the owner's explicit authorization. Report real output and attach a review patch; never fabricate verification.
