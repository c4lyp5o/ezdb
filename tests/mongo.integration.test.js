import { afterAll, beforeAll, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { MongoClient, ObjectId } from "mongodb";
import { createApp } from "../backend/app.js";
import { encodeKey } from "../backend/keys.js";

// Needs the scratch Mongo container. Credentials come from the environment only.
const MONGO = {
	engine: "mongo",
	host: "127.0.0.1",
	port: 57017,
	database: "ezdb_test",
	user: "ezdb",
	password: process.env.MONGO_PASSWORD,
};
const PORT = 18092;
const base = `http://127.0.0.1:${PORT}/api`;
let server;
let cookie;
let seedId;

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
	const admin = new MongoClient("mongodb://127.0.0.1:57017/?authSource=admin", {
		auth: { username: MONGO.user, password: MONGO.password },
	});
	await admin.connect();
	const coll = admin.db(MONGO.database).collection("ezdb_docs");
	await coll.deleteMany({});
	seedId = new ObjectId();
	await coll.insertMany([{ _id: seedId, name: "alpha" }, { name: "beta" }]);
	await admin.close();
	server = new Elysia()
		.use(createApp())
		.listen({ hostname: "127.0.0.1", port: PORT });
});

afterAll(async () => {
	await call("/disconnect", { method: "POST" });
	server.stop(true);
});

test("mongo: login, browse, create, edit and delete a document", async () => {
	const login = await call("/connect", { method: "POST", body: MONGO });
	expect(login.status).toBe(201);
	cookie = login.headers.get("set-cookie").split(";")[0];

	const cols = await (await call("/tables")).json();
	expect(cols.items).toContain("ezdb_docs");

	const page = await (await call("/tables/ezdb_docs?page=1&size=10")).json();
	expect(page.total).toBe(2);
	expect(page.key).toEqual(["_id"]);

	const created = await call("/tables/ezdb_docs/rows", {
		method: "POST",
		body: { name: "gamma" },
	});
	expect(created.status).toBe(201);

	const key = encodeKey({ _id: { $oid: seedId.toHexString() } });
	const edited = await call(`/tables/ezdb_docs/rows/${key}`, {
		method: "PATCH",
		body: { name: "alpha-2" },
	});
	expect(edited.status).toBe(200);

	const removed = await call(`/tables/ezdb_docs/rows/${key}`, {
		method: "DELETE",
	});
	expect(removed.status).toBe(200);
	expect(
		(await call(`/tables/ezdb_docs/rows/${key}`, { method: "DELETE" })).status,
	).toBe(404);
});

test("mongo: edits and deletes using the _id the list actually returns", async () => {
	const list = await (await call("/tables/ezdb_docs?page=1&size=10")).json();
	const row = list.rows.find((r) => r.name === "beta");
	expect(row._id.$oid).toMatch(/^[a-f0-9]{24}$/);
	const key = encodeKey({ _id: row._id });
	const edited = await call(`/tables/ezdb_docs/rows/${key}`, {
		method: "PATCH",
		body: { name: "beta-2" },
	});
	expect(edited.status).toBe(200);
	const removed = await call(`/tables/ezdb_docs/rows/${key}`, {
		method: "DELETE",
	});
	expect(removed.status).toBe(200);
});

test("mongo: refuses _id changes and non-object inserts", async () => {
	const target = new ObjectId().toHexString();
	const idEdit = await call(
		`/tables/ezdb_docs/rows/${encodeKey({ _id: target })}`,
		{ method: "PATCH", body: { _id: "x" } },
	);
	expect(idEdit.status).toBe(400);
	const arr = await call("/tables/ezdb_docs/rows", {
		method: "POST",
		body: [1, 2],
	});
	expect(arr.status).toBe(400);
});
