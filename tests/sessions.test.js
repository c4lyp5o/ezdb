import { expect, test } from "bun:test";
import { createSessionStore } from "../backend/sessions.js";

test("isolates sessions, refreshes idle expiry and closes expired connections", async () => {
	let time = 0;
	let closed = 0;
	const store = createSessionStore({ ttlMs: 10, now: () => time });
	const connection = {
		close: async () => {
			closed++;
		},
	};
	const token = store.create(connection);
	expect(await store.get("invalid")).toBeNull();
	time = 9;
	expect(await store.get(token)).toBe(connection);
	time = 19;
	expect(await store.get(token)).toBeNull();
	expect(closed).toBe(1);
	await store.remove(token);
	expect(closed).toBe(1);
	await store.close();
});

test("sweeps abandoned sessions without another request", async () => {
	let time = 0;
	let closed = 0;
	const store = createSessionStore({ ttlMs: 10, now: () => time });
	const token = store.create({
		close: async () => {
			closed++;
		},
	});
	time = 11;
	await store.sweep();
	expect(closed).toBe(1);
	expect(await store.get(token)).toBeNull();
	await store.close();
});
