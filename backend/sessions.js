import { randomBytes } from "node:crypto";
import { logger } from "./logger.js";

// Sessions and database connections stay in memory and are never persisted.
export function createSessionStore({
	ttlMs = 30 * 60 * 1000,
	now = Date.now,
} = {}) {
	const sessions = new Map();
	async function remove(token) {
		const session = sessions.get(token);
		if (!session) return;
		sessions.delete(token);
		await session.connection.close();
	}
	async function sweep() {
		await Promise.all(
			[...sessions.entries()]
				.filter(([, value]) => value.expiresAt <= now())
				.map(([token]) => remove(token)),
		);
	}
	const timer = setInterval(
		() => {
			sweep().catch(() => logger.error("[ezdb] Session cleanup failed"));
		},
		Math.min(ttlMs, 60000),
	);
	timer.unref();
	return {
		sweep,
		create(connection) {
			const token = randomBytes(32).toString("base64url");
			sessions.set(token, { connection, expiresAt: now() + ttlMs });
			return token;
		},
		async get(token) {
			const session = sessions.get(token);
			if (!session) return null;
			if (
				session.expiresAt <= now() ||
				session.connection.client?.expiresAt <= now()
			) {
				await remove(token);
				return null;
			}
			session.expiresAt = now() + ttlMs;
			return session.connection;
		},
		remove,
		async close() {
			clearInterval(timer);
			await Promise.all([...sessions.keys()].map(remove));
		},
	};
}
