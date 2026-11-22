# Changelog

## [Unreleased]

## [1.0.1] - 2026-11-22

### Changed
- The Docker image follows the ez standard: Alpine, runs as the unprivileged `bun` user (uid 1000), and a `HEALTHCHECK` that reports healthy within seconds of start.
- CI is two workflows, `test.yml` and `publish.yml`. Merging to `master` publishes `:<version>`, `:latest` and `:sha-<commit>` after the tests (and an image boot check) pass; a `vX.Y.Z` tag is optional and adds a GitHub Release.
- Every push to `development` publishes `:development` and `:sha-<commit>` after the tests, so unreleased changes can be tried without touching `master`.
- The image moves from the Debian to the Alpine Bun base and gains a healthcheck.
- Header, sidebar and sign-in use the shared ez `Brand`: the ez icon and the lowercase name.
- Dependencies updated (majors kept only where the tests passed), Docker image on oven/bun 1.4.5, Biome as the linter, and the shared ez favicon.

### Added
- Added explicit MariaDB connection option (port 3306), sharing the MySQL adapter.
- Verified MariaDB 11.4 login, browsing, pagination and CRUD with primary-key guards.
- Added MariaDB integration and browser login coverage plus an isolated CI service.
Versions follow Semantic Versioning. Entries describe implemented changes, not publication status.

## [1.0.0]

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
- No arbitrary queries, schema changes, bulk edits or field removal.
- Mobile data grids scroll horizontally. Physical-phone testing and exhaustive database-type coverage remain unverified.

## MySQL, MariaDB and uploaded SQLite

MySQL and MariaDB tables support browsing, pagination and record CRUD using database permissions. SQLite accepts standalone database uploads (32 MiB maximum); no server path or environment configuration is needed. Uploading requires explicit acknowledgement that the entire database is sent to a trusted server/operator. Use an offline backup, not a live WAL file.

Uploaded files are private per session, use generated storage names, and are removed on disconnect or 30 idle minutes. A fixed 24-hour deadline is enforced independently of activity; a 30-second cleanup sweep and startup sweep remove expired files and SQLite sidecars. If the server is stopped, cleanup resumes at startup. Operator backups/forensic erasure cannot be guaranteed. Download the edited copy before leaving; the original local file is not changed. Primary keys are required for individual SQL edits/deletes. No raw SQL console is exposed.

CI uses Ubuntu 24.04 and updated Node 24-based Actions, with isolated MySQL 8.4 and MariaDB 11.4 integration fixtures.
