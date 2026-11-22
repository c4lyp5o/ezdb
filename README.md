# ezdb

**v1.0.1 · MIT**

[GitHub repository](https://github.com/c4lyp5o/ezdb) (public, MIT). Version 1.0.1 is pushed to master; no version tag or GitHub Release has been published.

A quiet, dark-first ez-series workspace built with Bun, Elysia, React, Vite and Tailwind 4. Version metadata lives in package.json and appears in the footer. The footer links to the GitHub repository.

Lightweight, self-hosted database browser: PostgreSQL public-schema tables, MySQL/MariaDB tables, uploaded SQLite databases and MongoDB collections. Database credentials are the identity; database permissions enforce access.

## Run

Requires Bun 1.4.4 and an existing PostgreSQL, MySQL, MariaDB or MongoDB server, or a standalone SQLite upload. PostgreSQL 16, MySQL 8.4, MariaDB 11.4 and MongoDB 7 are the tested server targets. MongoDB users authenticate against admin; database-connection TLS configuration is not currently exposed by the login form.

    bun install --frozen-lockfile
    bun run build
    bun run start

Open http://127.0.0.1:8080. Defaults to loopback; EZDB_HOST and EZDB_PORT override the listener. Frontend development: run the backend separately and use bun run dev (Vite, port 5173).

## Features

- Database login, table/collection list, paginated records.
- Add records, edit individual records, confirm deletes.
- JSON object editor: quoted strings, numbers, booleans, null, arrays and objects. Updates send changed fields only. Omitted fields stay unchanged; null clears a value.
- PostgreSQL edits/deletes require a primary key. Empty inserts request database defaults.
- MongoDB uses canonical Extended JSON for BSON fidelity: ObjectIds, dates, longs, decimals and binary values retain their type. For example, an ObjectId is {"$oid":"abcdefabcdefabcdefabcdef"}; a plain hex string remains a string.
- Refresh restores an active connection using an HttpOnly cookie; passwords are not stored in browser storage.

## Boundaries

Local/private administration only, not a public multi-user service. No saved connections, SQL/query editor, schema management, bulk edits. MongoDB top-level dotted/operator field names are refused; removing fields is not supported. Large tables use exact PostgreSQL counts; MongoDB totals are estimates. Tables scroll horizontally on phones.

Sessions and connections are in memory, expire after 30 idle minutes and are swept periodically. Cookie lifetime is 30 minutes. Disconnect closes the connection; restart discards sessions. Use least-privilege database users and TLS at a trusted reverse proxy if accessing remotely. This is not a comprehensive security audit.

## Verify

    bun run lint
    bun run typecheck
    bun test
    bun run build

Integration tests require isolated ezdb_test databases on loopback PostgreSQL 55432 (postgres user), MySQL 53306, MariaDB 53307 and MongoDB 57017 (ezdb user; MongoDB admin authentication). Export PG_PASSWORD, MYSQL_PASSWORD, MARIADB_PASSWORD and MONGO_PASSWORD securely. Tests reset named fixture tables/collections; never point them at production. See DEVELOPER.md for fixture setup.

With the built server running and Python Playwright installed:

    python3 tests/ui-smoke.py

The browser suite submits the real login form using isolated fixture credentials, then exercises UI add/edit/delete, keyboard focus trapping and Escape cancellation, invalid JSON, pagination, refresh and disconnect at desktop and phone widths. Screenshots go under TMPDIR/ezdb-shots. Permission tests create temporary read-only users and verify browsing succeeds while insertion is refused. MongoDB users currently authenticate against admin.

## Container packaging

    docker build -t ezdb:local .
    docker run --rm -p 127.0.0.1:8080:8080 -v ./ezdb-data:/data ezdb:local   # /data holds logs/

The multi-stage image pins Bun 1.4.4, installs the lockfile, builds the frontend and runs as non-root. Publish only on loopback unless you have secured a trusted private ingress. Inside a container, localhost refers to that container, not the host database; use a database reachable on its private Docker network. No credentials are embedded in the image.

## GitHub workflow

CI is two workflows, the same in every ez repo. `test.yml` (lint, tests, build, and the Docker image built, booted and checked healthy) runs on pull requests. `publish.yml` runs `test.yml` first, then publishes the image: `:development` on every push to `development`, `:latest` and `:<version>` on every push to `master`, and a GitHub Release on an optional `vX.Y.Z` tag; see [DEVELOPER.md](DEVELOPER.md#branches-and-releases). The test job also runs the isolated PostgreSQL/MySQL/MariaDB/MongoDB tests and the real Chromium smoke tests, and uploads the browser evidence as an artifact.

## Project documentation

- [Contributing and test setup](DEVELOPER.md)
- [Architecture and write semantics](DEVELOPER.md)
- [Agent contract](AGENTS.md)
- [Changelog](CHANGELOG.md)
- [Security boundaries and reporting](#security-policy)
- [MIT license](LICENSE)

The footer displays the package version and links to [c4lyp5o/ezdb](https://github.com/c4lyp5o/ezdb). The repository is private, so viewing source requires GitHub access.

## MySQL, MariaDB and uploaded SQLite

MySQL and MariaDB tables support browsing, pagination and record CRUD using database permissions. SQLite accepts standalone database uploads (32 MiB maximum); no server path or environment configuration is needed. Uploading requires explicit acknowledgement that the entire database is sent to a trusted server/operator. Use an offline backup, not a live WAL file.

Uploaded files are private per session, use generated storage names, and are removed on disconnect or 30 idle minutes. A fixed 24-hour deadline is enforced independently of activity; a 30-second cleanup sweep and startup sweep remove expired files and SQLite sidecars. If the server is stopped, cleanup resumes at startup. Operator backups/forensic erasure cannot be guaranteed. Download the edited copy before leaving; the original local file is not changed. Primary keys are required for individual SQL edits/deletes. No raw SQL console is exposed.

CI uses Ubuntu 24.04 and updated Node 24-based Actions, with isolated MySQL 8.4 and MariaDB 11.4 integration fixtures.

### MariaDB support

Select **MariaDB** in the connection form (default port 3306). It shares the MySQL protocol adapter, not a separate driver. Supported operations: list tables, paginated browse, insert, update and delete; individual edits/deletes require a complete primary key. Database permissions apply. Tested against MariaDB 11.4; other versions are not verified.

Tests require an isolated loopback MariaDB on port 53307, database ezdb_test, user ezdb. Supply MARIADB_PASSWORD securely for test fixtures only. CI provisions this instance automatically. MariaDB coverage includes real HTTP login/session/CRUD/logout, composite-key guards, identifier injection refusal and redacted authentication failures.

## Security policy

This tool is for localhost or trusted private networks only. No supported public service or guaranteed response SLA is offered. Use least-privilege database accounts and a trusted TLS ingress for remote private access. Application sessions hold live database connections in process memory; restarting clears them. No saved passwords or connections are provided.

Do not file public issues containing credentials, exploit payloads against real systems or database records. Report vulnerabilities privately to the repository owner using GitHub private vulnerability reporting if enabled, or an existing private channel. Do not assume that reporting is enabled before the repository is published.

Known hardening gaps include connection/rate quotas, exhaustive type coverage and a full security audit. Browser-to-app TLS does not configure database transport TLS. Do not expose the app to the public internet. Tests are destructive and must only target dedicated fixtures.

### MySQL, MariaDB and uploaded SQLite

MySQL and MariaDB tables support browsing, pagination and record CRUD using database permissions. SQLite accepts standalone database uploads (32 MiB maximum); no server path or environment configuration is needed. Uploading requires explicit acknowledgement that the entire database is sent to a trusted server/operator. Use an offline backup, not a live WAL file.

Uploaded files are private per session, use generated storage names, and are removed on disconnect or 30 idle minutes. A fixed 24-hour deadline is enforced independently of activity; a 30-second cleanup sweep and startup sweep remove expired files and SQLite sidecars. If the server is stopped, cleanup resumes at startup. Operator backups/forensic erasure cannot be guaranteed. Download the edited copy before leaving; the original local file is not changed. Primary keys are required for individual SQL edits/deletes. No raw SQL console is exposed.

CI uses Ubuntu 24.04 and updated Node 24-based Actions, with isolated MySQL 8.4 and MariaDB 11.4 integration fixtures.
