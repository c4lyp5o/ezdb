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

## MySQL, MariaDB and uploaded SQLite

MySQL and MariaDB tables support browsing, pagination and record CRUD using database permissions. SQLite accepts standalone database uploads (32 MiB maximum); no server path or environment configuration is needed. Uploading requires explicit acknowledgement that the entire database is sent to a trusted server/operator. Use an offline backup, not a live WAL file.

Uploaded files are private per session, use generated storage names, and are removed on disconnect or 30 idle minutes. A fixed 24-hour deadline is enforced independently of activity; a 30-second cleanup sweep and startup sweep remove expired files and SQLite sidecars. If the server is stopped, cleanup resumes at startup. Operator backups/forensic erasure cannot be guaranteed. Download the edited copy before leaving; the original local file is not changed. Primary keys are required for individual SQL edits/deletes. No raw SQL console is exposed.

CI uses Ubuntu 24.04 and updated Node 24-based Actions, with isolated MySQL 8.4 and MariaDB 11.4 integration fixtures.

### MariaDB support

Select **MariaDB** in the connection form (default port 3306). It shares the MySQL protocol adapter, not a separate driver. Supported operations: list tables, paginated browse, insert, update and delete; individual edits/deletes require a complete primary key. Database permissions apply. Tested against MariaDB 11.4; other versions are not verified.

Tests require an isolated loopback MariaDB on port 53307, database ezdb_test, user ezdb. Supply MARIADB_PASSWORD securely for test fixtures only. CI provisions this instance automatically. MariaDB coverage includes real HTTP login/session/CRUD/logout, composite-key guards, identifier injection refusal and redacted authentication failures.

## Commands

| Task | Command |
| --- | --- |
| Run the dev servers | `bun run dev` |
| Run the test suite | `bun run test` |
| Lint with Biome | `bun run lint` |
| Apply Biome's safe fixes | `bun run lint:fix` |
| Build | `bun run build` |
| Type-check | `bun run typecheck` |
| Start in production (PM2 where configured) | `bun run start` |

`bun test` needs the throwaway MySQL, MariaDB, Postgres and Mongo services from `.github/workflows/test.yml` (same ports and `*_PASSWORD` variables); CI starts them as service containers. `bun run typecheck` type-checks.

## Linting

[Biome](https://biomejs.dev) 2.6.8 is the only linter. It is pinned at the repo root, so run it from there: `bun run lint` checks, `bun run lint:fix` applies safe fixes. Configuration is `biome.json`; `biome.json` also sets the formatting rules (`bunx biome check --write .` applies them). CI runs the same command.

## Branches and releases

There are two long-lived branches:

| Branch | Role |
| --- | --- |
| `development` | Integration branch. Branch from it (`feat/…`, `fix/…`, `chore/…`) and open every PR against it. |
| `master` | Released code. Only `development` is merged into it, by PR. |

No other long-lived branches (`main`, `dev`, `staging`, …) are kept; delete feature branches once merged.

To release: bump the version in `package.json` (validated by `scripts/validate-release.js`), move the `[Unreleased]` notes in `CHANGELOG.md` under `## [x.y.z] - YYYY-MM-DD`, then merge `development` into `master`. Every push to `master` runs `publish.yml`: `test.yml` first, then `ghcr.io/c4lyp5o/ezdb:<version>`, `:latest` and `:sha-<commit>`. Tagging `vX.Y.Z` afterwards is optional: it checks the tag matches `package.json`, pushes `:<version>` and creates a GitHub Release from that version's changelog section. Every push to `development` publishes `ghcr.io/c4lyp5o/ezdb:development` and `:sha-<commit>` after the tests, for trying unreleased changes in a separate container; it never touches `:latest` or a version tag.

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (`fix(scope): …`) with a body that explains why. Add a `CHANGELOG.md` line under `[Unreleased]` for anything a user would notice. Every behaviour change needs a test; a bug fix needs one that fails without the fix.

## Docker

The image follows the ez standard Dockerfile: a Bun stage builds the frontend, then `oven/bun:1.4.5-alpine` runs the app as `bun` (uid 1000) with a `HEALTHCHECK` on `/`. Keep the Bun version in step with `bun-version` in `.github/workflows/`. `test.yml` builds the image, boots it and waits for healthy; do the same locally (`docker build -t ezdb .`, then `docker run`) after changing the Dockerfile.

## Contributing

Discuss scope before large changes. Keep patches focused; use the conventions in AGENTS.md.

### Setup

Install Bun 1.4.4 and Docker. Run `bun install --frozen-lockfile`. For frontend development, run `bun start` and `bun run dev` in separate terminals; Vite proxies /api to the backend. For production assets run `bun run build` first.

### Isolated tests

Tests require PostgreSQL 16 on 127.0.0.1:55432 (database ezdb_test, user postgres) and MongoDB 7 on 127.0.0.1:57017 (root user ezdb, authSource admin). Export PG_PASSWORD and MONGO_PASSWORD from a private environment. Never use production: tests reset fixture tables and collections and create temporary users.

Start dedicated containers with these environment mappings:

- postgres:16-alpine: POSTGRES_DB=ezdb_test, POSTGRES_USER=postgres, POSTGRES_PASSWORD from PG_PASSWORD; publish 127.0.0.1:55432:5432.
- mongo:7: MONGO_INITDB_ROOT_USERNAME=ezdb, MONGO_INITDB_ROOT_PASSWORD from MONGO_PASSWORD; publish 127.0.0.1:57017:27017.
- mysql:8.4: MYSQL_DATABASE=ezdb_test, MYSQL_USER=ezdb, MYSQL_PASSWORD from MYSQL_PASSWORD and MYSQL_ALLOW_EMPTY_PASSWORD=yes (isolated fixture only); publish 127.0.0.1:53306:3306.
- mariadb:11.4: MARIADB_DATABASE=ezdb_test, MARIADB_USER=ezdb, MARIADB_PASSWORD from MARIADB_PASSWORD and MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=yes (isolated fixture only); publish 127.0.0.1:53307:3306.

Run sequentially: `bun run lint`, `bun run typecheck`, `bun test`, `bun run build`. CI provisions all four services with runner-only fixture credentials; it does not need database secrets.

For UI checks install Python Playwright in a virtual environment (`pip install playwright`, `python -m playwright install chromium`), export TMPDIR to an existing scratch directory, start `bun start`, then run `python tests/ui-smoke.py`. Run Bun tests immediately before UI tests to reset fixtures. The browser suite submits fixture credentials into the real login form; never use real-account credentials. Stop your server afterward.

### Review and release

Include behavior, tests executed and limitations in the PR. Do not include credentials, connection strings, production data or private screenshots. Use small conventional commit subjects. Work on development/feature branches and promote to main or master through reviewed PRs.

Version lives in package.json; update CHANGELOG.md with each release. Tags use v followed by the exact version. CI tests PRs; pushes publish GHCR images only after tests pass. Stable branch gets latest plus its branch tag; development gets development; tags get their version; all get sha tags. No automated deployment or GitHub Release creation is configured. Repository publication, pushes, tags and releases require owner approval. See [Security policy](README.md#security-policy) for vulnerability handling.

#### MariaDB support

Select **MariaDB** in the connection form (default port 3306). It shares the MySQL protocol adapter, not a separate driver. Supported operations: list tables, paginated browse, insert, update and delete; individual edits/deletes require a complete primary key. Database permissions apply. Tested against MariaDB 11.4; other versions are not verified.

Tests require an isolated loopback MariaDB on port 53307, database ezdb_test, user ezdb. Supply MARIADB_PASSWORD securely for test fixtures only. CI provisions this instance automatically. MariaDB coverage includes real HTTP login/session/CRUD/logout, composite-key guards, identifier injection refusal and redacted authentication failures.
