# ezdb

**v1.0.0 · MIT**

[GitHub repository](https://github.com/c4lyp5o/ezdb) (private; repository access required). Version 1.0.0 is pushed to master; no version tag or GitHub Release has been published.

A quiet, dark-first ez-series workspace built with Bun, Elysia, React, Vite and Tailwind 4. Version metadata lives in package.json and appears in the footer. The footer links to the GitHub repository.

Lightweight, self-hosted database browser: PostgreSQL public-schema tables and MongoDB collections. Database credentials are the identity; database permissions enforce access.

## Run

Requires Bun 1.4.4 and an existing PostgreSQL or MongoDB server. PostgreSQL 16 and MongoDB 7 are the tested targets. MongoDB users authenticate against admin; database-connection TLS configuration is not currently exposed by the login form.

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

Local/private administration only, not a public multi-user service. No saved connections, SQL/query editor, schema management, bulk edits, MySQL or SQLite yet. MongoDB top-level dotted/operator field names are refused; removing fields is not supported. Large tables use exact PostgreSQL counts; MongoDB totals are estimates. Tables scroll horizontally on phones.

Sessions and connections are in memory, expire after 30 idle minutes and are swept periodically. Cookie lifetime is 30 minutes. Disconnect closes the connection; restart discards sessions. Use least-privilege database users and TLS at a trusted reverse proxy if accessing remotely. This is not a comprehensive security audit.

## Verify

    bun run lint
    bun run typecheck
    bun test
    bun run build

Integration tests require isolated ezdb_test databases on loopback PostgreSQL 55432 (postgres user) and MongoDB 57017 (ezdb user, admin authentication). Export PG_PASSWORD and MONGO_PASSWORD securely. Tests reset named fixture tables/collections; never point them at production.

With the built server running and Python Playwright installed:

    python3 tests/ui-smoke.py

The browser suite submits the real login form using isolated fixture credentials, then exercises UI add/edit/delete, keyboard focus trapping and Escape cancellation, invalid JSON, pagination, refresh and disconnect at desktop and phone widths. Screenshots go under TMPDIR/ezdb-shots. Permission tests create temporary read-only users and verify browsing succeeds while insertion is refused. MongoDB users currently authenticate against admin.

## Container packaging

    docker build -t ezdb:local .
    docker run --rm -p 127.0.0.1:8080:8080 ezdb:local

The multi-stage image pins Bun 1.4.4, installs the lockfile, builds the frontend and runs as non-root. Publish only on loopback unless you have secured a trusted private ingress. Inside a container, localhost refers to that container, not the host database; use a database reachable on its private Docker network. No credentials are embedded in the image.

## GitHub workflow

The workflow in .github/workflows/ci.yml follows the ez-series Test → GHCR image pattern. PRs and pushes to main, master or development run locked dependency installation, release metadata validation, lint, typecheck, isolated PostgreSQL/MongoDB tests, production build and real Chromium smoke tests. Browser evidence is uploaded as an artifact. Only successful push runs publish an amd64 image; PRs and manual runs do not publish.

Stable branches publish latest and their branch name, development publishes development, and version tags publish their exact tag. Every image also receives a full commit-SHA tag. Version tags must match package.json. The built-in GITHUB_TOKEN needs packages:write for publishing. There is no deploy job and no automatic GitHub Release creation. These are configured workflows, not a claim of a successful hosted CI run.

## Project documentation

- [Contributing and test setup](CONTRIBUTING.md)
- [Architecture and write semantics](DEVELOPER.md)
- [Agent contract](AGENTS.md)
- [Changelog](CHANGELOG.md)
- [Security boundaries and reporting](SECURITY.md)
- [MIT license](LICENSE)

The footer displays the package version and links to [c4lyp5o/ezdb](https://github.com/c4lyp5o/ezdb). The repository is private, so viewing source requires GitHub access.
