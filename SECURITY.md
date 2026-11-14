# Security policy

This tool is for localhost or trusted private networks only. No supported public service or guaranteed response SLA is offered. Use least-privilege database accounts and a trusted TLS ingress for remote private access. Application sessions hold live database connections in process memory; restarting clears them. No saved passwords or connections are provided.

Do not file public issues containing credentials, exploit payloads against real systems or database records. Report vulnerabilities privately to the repository owner using GitHub private vulnerability reporting if enabled, or an existing private channel. Do not assume that reporting is enabled before the repository is published.

Known hardening gaps include connection/rate quotas, exhaustive type coverage and a full security audit. Browser-to-app TLS does not configure database transport TLS. Do not expose the app to the public internet. Tests are destructive and must only target dedicated fixtures.

## MySQL, MariaDB and uploaded SQLite

MySQL and MariaDB tables support browsing, pagination and record CRUD using database permissions. SQLite accepts standalone database uploads (32 MiB maximum); no server path or environment configuration is needed. Uploading requires explicit acknowledgement that the entire database is sent to a trusted server/operator. Use an offline backup, not a live WAL file.

Uploaded files are private per session, use generated storage names, and are removed on disconnect or 30 idle minutes. A fixed 24-hour deadline is enforced independently of activity; a 30-second cleanup sweep and startup sweep remove expired files and SQLite sidecars. If the server is stopped, cleanup resumes at startup. Operator backups/forensic erasure cannot be guaranteed. Download the edited copy before leaving; the original local file is not changed. Primary keys are required for individual SQL edits/deletes. No raw SQL console is exposed.

CI uses Ubuntu 24.04 and updated Node 24-based Actions, with isolated MySQL 8.4 and MariaDB 11.4 integration fixtures.
