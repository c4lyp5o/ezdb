// Quote PostgreSQL identifiers; values must still use bound parameters.
export function quoteIdentifier(value) {
	if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
		throw new TypeError("Invalid SQL identifier");
	}
	return `"${value.replaceAll('"', '""')}"`;
}
