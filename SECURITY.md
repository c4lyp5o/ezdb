# Security policy

This tool is for localhost or trusted private networks only. No supported public service or guaranteed response SLA is offered. Use least-privilege database accounts and a trusted TLS ingress for remote private access. Application sessions hold live database connections in process memory; restarting clears them. No saved passwords or connections are provided.

Do not file public issues containing credentials, exploit payloads against real systems or database records. Report vulnerabilities privately to the repository owner using GitHub private vulnerability reporting if enabled, or an existing private channel. Do not assume that reporting is enabled before the repository is published.

Known hardening gaps include connection/rate quotas, exhaustive type coverage and a full security audit. Browser-to-app TLS does not configure database transport TLS. Do not expose the app to the public internet. Tests are destructive and must only target dedicated fixtures.
