# Contributing

Discuss scope before large changes. Keep patches focused; use the conventions in AGENTS.md.

## Setup

Install Bun 1.4.4 and Docker. Run `bun install --frozen-lockfile`. For frontend development, run `bun start` and `bun run dev` in separate terminals; Vite proxies /api to the backend. For production assets run `bun run build` first.

## Isolated tests

Tests require PostgreSQL 16 on 127.0.0.1:55432 (database ezdb_test, user postgres) and MongoDB 7 on 127.0.0.1:57017 (root user ezdb, authSource admin). Export PG_PASSWORD and MONGO_PASSWORD from a private environment. Never use production: tests reset fixture tables and collections and create temporary users.

Start dedicated containers with these environment mappings:

- postgres:16-alpine: POSTGRES_DB=ezdb_test, POSTGRES_USER=postgres, POSTGRES_PASSWORD from PG_PASSWORD; publish 127.0.0.1:55432:5432.
- mongo:7: MONGO_INITDB_ROOT_USERNAME=ezdb, MONGO_INITDB_ROOT_PASSWORD from MONGO_PASSWORD; publish 127.0.0.1:57017:27017.
- mysql:8.4: MYSQL_DATABASE=ezdb_test, MYSQL_USER=ezdb, MYSQL_PASSWORD from MYSQL_PASSWORD and MYSQL_ALLOW_EMPTY_PASSWORD=yes (isolated fixture only); publish 127.0.0.1:53306:3306.
- mariadb:11.4: MARIADB_DATABASE=ezdb_test, MARIADB_USER=ezdb, MARIADB_PASSWORD from MARIADB_PASSWORD and MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=yes (isolated fixture only); publish 127.0.0.1:53307:3306.

Run sequentially: `bun run lint`, `bun run typecheck`, `bun test`, `bun run build`. CI provisions all four services with runner-only fixture credentials; it does not need database secrets.

For UI checks install Python Playwright in a virtual environment (`pip install playwright`, `python -m playwright install chromium`), export TMPDIR to an existing scratch directory, start `bun start`, then run `python tests/ui-smoke.py`. Run Bun tests immediately before UI tests to reset fixtures. The browser suite submits fixture credentials into the real login form; never use real-account credentials. Stop your server afterward.

## Review and release

Include behavior, tests executed and limitations in the PR. Do not include credentials, connection strings, production data or private screenshots. Use small conventional commit subjects. Work on development/feature branches and promote to main or master through reviewed PRs.

Version lives in package.json; update CHANGELOG.md with each release. Tags use v followed by the exact version. CI tests PRs; pushes publish GHCR images only after tests pass. Stable branch gets latest plus its branch tag; development gets development; tags get their version; all get sha tags. No automated deployment or GitHub Release creation is configured. Repository publication, pushes, tags and releases require owner approval. See SECURITY.md for vulnerability handling.

### MariaDB support

Select **MariaDB** in the connection form (default port 3306). It shares the MySQL protocol adapter, not a separate driver. Supported operations: list tables, paginated browse, insert, update and delete; individual edits/deletes require a complete primary key. Database permissions apply. Tested against MariaDB 11.4; other versions are not verified.

Tests require an isolated loopback MariaDB on port 53307, database ezdb_test, user ezdb. Supply MARIADB_PASSWORD securely for test fixtures only. CI provisions this instance automatically. MariaDB coverage includes real HTTP login/session/CRUD/logout, composite-key guards, identifier injection refusal and redacted authentication failures.
