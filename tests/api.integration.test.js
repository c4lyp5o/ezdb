import { afterAll, beforeAll, expect, test } from "bun:test";
import { Elysia } from "elysia";
import pg from "pg";
import { createApp } from "../backend/app.js";
import { encodeKey } from "../backend/keys.js";

// Needs the scratch containers (see ezdb test setup). Credentials come from the environment only.
const PG = {
	engine: "postgres",
	host: "127.0.0.1",
	port: 55432,
	database: "ezdb_test",
	user: "postgres",
	password: process.env.PG_PASSWORD,
};
const PORT = 18090;
const base = `http://127.0.0.1:${PORT}/api`;
let server;
let cookie;

async function call(path, init = {}) {
	return fetch(`${base}${path}`, {
		...init,
		headers: {
			"content-type": "application/json",
			...(cookie ? { cookie } : {}),
			...init.headers,
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});
}

beforeAll(async () => {
	const admin = new pg.Client({
		host: PG.host,
		port: PG.port,
		database: PG.database,
		user: PG.user,
		password: PG.password,
	});
	await admin.connect();
	await admin.query("DROP TABLE IF EXISTS ezdb_items");
	await admin.query(
		"CREATE TABLE ezdb_items (id int PRIMARY KEY, name text NOT NULL)",
	);
	await admin.query("INSERT INTO ezdb_items VALUES (1, 'alpha'), (2, 'beta')");
	await admin.end();
	server = new Elysia()
		.use(createApp())
		.listen({ hostname: "127.0.0.1", port: PORT });
});

afterAll(async () => {
	await call("/disconnect", { method: "POST" });
	server.stop(true);
});

test("refuses data routes before login", async () => {
	cookie = undefined;
	expect((await call("/tables")).status).toBe(401);
	expect((await call("/session")).status).toBe(401);
});

test("refuses unknown engines and bad passwords without echoing the password", async () => {
	const unknown = await call("/connect", {
		method: "POST",
		body: { ...PG, engine: "unsupported" },
	});
	expect(unknown.status).toBe(400);
	const badPw = await call("/connect", {
		method: "POST",
		body: { ...PG, password: "definitely-wrong" },
	});
	expect(badPw.status).toBe(401);
	expect(await badPw.text()).not.toContain("definitely-wrong");
	const invalid = await call("/connect", {
		method: "POST",
		body: { ...PG, port: -1, password: "redaction-check-marker" },
	});
	expect(invalid.status).toBe(422);
	expect(await invalid.text()).not.toContain("redaction-check-marker");
});

test("postgres: login, browse, create, edit and delete one row", async () => {
	const login = await call("/connect", { method: "POST", body: PG });
	expect(login.status).toBe(201);
	cookie = login.headers.get("set-cookie").split(";")[0];

	expect(await (await call("/session")).json()).toEqual({
		engine: "postgres",
		database: "ezdb_test",
	});
	const crossOrigin = await call("/tables/ezdb_items/rows", {
		method: "POST",
		headers: { origin: "https://untrusted.invalid" },
		body: { id: 999, name: "blocked" },
	});
	expect(crossOrigin.status).toBe(403);
	const tables = await (await call("/tables")).json();
	expect(tables.items).toContain("ezdb_items");

	const page = await (await call("/tables/ezdb_items?page=1&size=10")).json();
	expect(page.total).toBe(2);
	expect(page.key).toEqual(["id"]);

	const created = await call("/tables/ezdb_items/rows", {
		method: "POST",
		body: { id: 3, name: "gamma" },
	});
	expect(created.status).toBe(201);

	const key = encodeKey({ id: 3 });
	const edited = await call(`/tables/ezdb_items/rows/${key}`, {
		method: "PATCH",
		body: { name: "delta" },
	});
	expect(edited.status).toBe(200);
	expect((await edited.json()).name).toBe("delta");

	const removed = await call(`/tables/ezdb_items/rows/${key}`, {
		method: "DELETE",
	});
	expect(removed.status).toBe(200);
	expect(
		(await call(`/tables/ezdb_items/rows/${key}`, { method: "DELETE" })).status,
	).toBe(404);
});

test("postgres: rejects unknown columns, primary-key edits and bad keys", async () => {
	const unknownCol = await call("/tables/ezdb_items/rows", {
		method: "POST",
		body: { id: 9, name: "x", bogus: 1 },
	});
	expect(unknownCol.status).toBe(400);

	const pkEdit = await call(`/tables/ezdb_items/rows/${encodeKey({ id: 1 })}`, {
		method: "PATCH",
		body: { id: 99 },
	});
	expect(pkEdit.status).toBe(400);

	const badKey = await call("/tables/ezdb_items/rows/not-base64-json", {
		method: "DELETE",
	});
	expect(badKey.status).toBe(400);
});

test("postgres: rejects SQL in a table name", async () => {
	const res = await call("/tables/ezdb_items;DROP%20TABLE%20ezdb_items", {
		method: "GET",
	});
	expect(res.status).toBe(404);
	expect((await call("/tables/ezdb_items")).status).toBe(200);
});

test("sessions: independent logins, tampering and logout isolation", async () => {
	const loginA = await call("/connect", {
		method: "POST",
		body: PG,
		headers: { cookie: "" },
	});
	const loginB = await call("/connect", {
		method: "POST",
		body: PG,
		headers: { cookie: "" },
	});
	expect(loginA.status).toBe(201);
	expect(loginB.status).toBe(201);
	const a = loginA.headers.get("set-cookie").split(";")[0];
	const b = loginB.headers.get("set-cookie").split(";")[0];
	expect(a).not.toBe(b);
	expect(loginA.headers.get("set-cookie")).toContain("HttpOnly");
	expect(loginA.headers.get("set-cookie").toLowerCase()).toContain(
		"samesite=strict",
	);
	try {
		expect((await call("/session", { headers: { cookie: a } })).status).toBe(
			200,
		);
		expect(
			(await call("/session", { headers: { cookie: `${b}tampered` } })).status,
		).toBe(401);
		expect(
			(await call("/disconnect", { method: "POST", headers: { cookie: a } }))
				.status,
		).toBe(200);
		expect((await call("/session", { headers: { cookie: a } })).status).toBe(
			401,
		);
		expect((await call("/session", { headers: { cookie: b } })).status).toBe(
			200,
		);
	} finally {
		await call("/disconnect", { method: "POST", headers: { cookie: a } });
		await call("/disconnect", { method: "POST", headers: { cookie: b } });
	}
});

test("cross-origin mutations cannot change records or log out a session", async () => {
	const headers = { origin: "https://untrusted.invalid" };
	const key = encodeKey({ id: 1 });
	const before = await (await call("/tables/ezdb_items")).json();
	for (const [path, method, body] of [
		["/tables/ezdb_items/rows", "POST", { id: 999, name: "blocked" }],
		[`/tables/ezdb_items/rows/${key}`, "PATCH", { name: "blocked" }],
		[`/tables/ezdb_items/rows/${key}`, "DELETE", undefined],
		["/disconnect", "POST", undefined],
		["/connect", "POST", PG],
	]) {
		expect((await call(path, { method, body, headers })).status).toBe(403);
	}
	expect((await call("/session")).status).toBe(200);
	expect(await (await call("/tables/ezdb_items")).json()).toEqual(before);
});
