// Row keys travel in URLs as base64url(JSON). Keys are primary-key columns (SQL) or {_id} (Mongo).
export function encodeKey(key) {
	return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

export function decodeKey(text) {
	let parsed;
	try {
		parsed = JSON.parse(
			Buffer.from(String(text), "base64url").toString("utf8"),
		);
	} catch {
		throw Object.assign(new Error("Invalid row key"), { status: 400 });
	}
	if (
		!parsed ||
		typeof parsed !== "object" ||
		Array.isArray(parsed) ||
		Object.keys(parsed).length === 0
	) {
		throw Object.assign(new Error("Invalid row key"), { status: 400 });
	}
	return parsed;
}

export function clampPage({ page, size }) {
	const p = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
	const s = Math.min(100, Math.max(1, Number.parseInt(size ?? "25", 10) || 25));
	return { page: p, size: s, offset: (p - 1) * s };
}
