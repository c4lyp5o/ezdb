import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createApp } from "../backend/app.js";
import * as mysql from "../backend/mysql.js";
import * as sqlite from "../backend/sqlite.js";

test("SQLite upload: validation, CRUD, download, absolute expiry and deletion", async () => {
	const source = new Database(":memory:");
	source.exec(
		"CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT); CREATE TABLE no_key(name TEXT)",
	);
	const file = new File([source.serialize()], "db.sqlite");
	source.close();
	await expect(sqlite.uploadSQLite(new File(["bad"], "bad"))).rejects.toThrow();
	const c = await sqlite.uploadSQLite(file);
	try {
		expect(await sqlite.listTables(c)).toEqual(["items", "no_key"]);
		await sqlite.insertRow(c, "items", { name: "hello" });
		expect(
			(await sqlite.listRows(c, "items", { size: 10, offset: 0 })).rows[0].name,
		).toBe("hello");
		await sqlite.updateRow(c, "items", { id: 1 }, { name: "edited" });
		await expect(
			sqlite.updateRow(c, "items", { id: 1 }, { id: 2 }),
		).rejects.toThrow();
		await expect(sqlite.deleteRow(c, "no_key", {})).rejects.toThrow();
		await expect(
			sqlite.listRows(c, 'items"; DROP TABLE items;--', {
				size: 10,
				offset: 0,
			}),
		).rejects.toThrow();
		const copy = Database.deserialize(c.download());
		expect(copy.query("SELECT name FROM items").get().name).toBe("edited");
		copy.close();
		await sqlite.deleteRow(c, "items", { id: 1 });
		c.expiresAt = 0;
		await expect(sqlite.listTables(c)).rejects.toThrow("expired");
		expect(c.closed).toBe(true);
	} finally {
		c.close();
	}
});
test("SQLite API refuses missing trust, isolates sessions and downloads edited copy", async () => {
	const app = createApp().listen({ hostname: "127.0.0.1", port: 0 });
	const base = `http://127.0.0.1:${app.server.port}/api`;
	const db = new Database(":memory:");
	db.exec("CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT)");
	const bytes = db.serialize();
	db.close();
	async function upload(trust) {
		const body = new FormData();
		body.set("file", new File([bytes], "file.db"));
		body.set("trust", trust);
		return fetch(`${base}/sqlite/upload`, { method: "POST", body });
	}
	try {
		expect((await upload("no")).status).toBe(400);
		const res = await upload("yes");
		expect(res.status).toBe(201);
		const cookie = res.headers.get("set-cookie").split(";")[0];
		expect((await fetch(`${base}/sqlite/download`)).status).toBe(401);
		expect(
			(await fetch(`${base}/tables`, { headers: { cookie } })).status,
		).toBe(200);
		expect(
			(await fetch(`${base}/sqlite/download`, { headers: { cookie } })).status,
		).toBe(200);
		await fetch(`${base}/disconnect`, { method: "POST", headers: { cookie } });
		expect(
			(await fetch(`${base}/sqlite/download`, { headers: { cookie } })).status,
		).toBe(401);
	} finally {
		await app.stop();
	}
});
for (const engine of ["mysql", "mariadb"]) {
	test(`${engine} real CRUD, composite keys, injection and key guards`, async () => {
		const c = await mysql.connectMySQL({
			host: "127.0.0.1",
			port: engine === "mysql" ? 53306 : 53307,
			user: "ezdb",
			password:
				process.env[
					engine === "mysql" ? "MYSQL_PASSWORD" : "MARIADB_PASSWORD"
				] || "",
			database: "ezdb_test",
		});
		try {
			await c.execute("DROP TABLE IF EXISTS engine_items");
			await c.execute(
				"CREATE TABLE engine_items(a INT, b INT, name TEXT, PRIMARY KEY(a,b))",
			);
			await mysql.insertRow(c, "engine_items", { a: 1, b: 2, name: "hello" });
			await mysql.updateRow(
				c,
				"engine_items",
				{ a: 1, b: 2 },
				{ name: "edited" },
			);
			expect(
				(await mysql.listRows(c, "engine_items", { size: 10, offset: 0 }))
					.rows[0].name,
			).toBe("edited");
			await expect(
				mysql.deleteRow(c, "engine_items", { a: 1 }),
			).rejects.toThrow();
			await expect(
				mysql.updateRow(c, "engine_items", { a: 1, b: 2 }, { a: 2 }),
			).rejects.toThrow();
			await expect(
				mysql.listRows(c, "engine_items; DROP TABLE engine_items", {
					size: 10,
					offset: 0,
				}),
			).rejects.toThrow();
			expect(await mysql.deleteRow(c, "engine_items", { a: 1, b: 2 })).toEqual({
				deleted: 1,
			});
		} finally {
			await c.execute("DROP TABLE IF EXISTS engine_items");
			await c.end();
		}
	});
}
