import { expect, test } from "bun:test";
import { createApp } from "../backend/app.js";
import { encodeKey } from "../backend/keys.js";
import { connectMySQL } from "../backend/mysql.js";

test("MariaDB HTTP login, pagination, CRUD, key guards, logout and redacted failures", async () => {
	const opts = {
		host: "127.0.0.1",
		port: 53307,
		user: "ezdb",
		password: process.env.MARIADB_PASSWORD || "",
		database: "ezdb_test",
	};
	const c = await connectMySQL(opts);
	const app = createApp().listen({ hostname: "127.0.0.1", port: 0 });
	const base = `http://127.0.0.1:${app.server.port}/api`;
	let cookie = "";
	const call = (route, method = "GET", body) =>
		fetch(base + route, {
			method,
			headers: { "content-type": "application/json", cookie },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	try {
		expect(
			(await c.query("SELECT VERSION() AS version"))[0][0].version,
		).toContain("MariaDB");
		await c.query("CREATE TABLE maria_http(id INT PRIMARY KEY, name TEXT)");
		expect((await call("/tables")).status).toBe(401);
		const login = await call("/connect", "POST", {
			...opts,
			engine: "mariadb",
		});
		expect(login.status).toBe(201);
		cookie = login.headers.get("set-cookie").split(";")[0];
		expect(await (await call("/session")).json()).toEqual({
			engine: "mariadb",
			database: "ezdb_test",
		});
		expect((await (await call("/tables")).json()).items).toContain(
			"maria_http",
		);
		expect(
			(await call("/tables/maria_http/rows", "POST", { id: 1, name: "before" }))
				.status,
		).toBe(201);
		const key = encodeKey({ id: 1 });
		expect(
			(await call(`/tables/maria_http/rows/${key}`, "PATCH", { name: "after" }))
				.status,
		).toBe(200);
		const page = await (await call("/tables/maria_http?page=1&size=1")).json();
		expect(page.rows).toEqual([{ id: 1, name: "after" }]);
		expect(page.total).toBe(1);
		expect(
			(await call(`/tables/maria_http/rows/${key}`, "PATCH", { id: 2 })).status,
		).toBe(400);
		expect(
			(await call(`/tables/maria_http/rows/${key}`, "DELETE")).status,
		).toBe(200);
		expect((await call("/disconnect", "POST")).status).toBe(200);
		expect((await call("/tables")).status).toBe(401);
		const bad = await call("/connect", "POST", {
			...opts,
			engine: "mariadb",
			password: "invalid-maria-fixture",
		});
		expect(bad.status).toBe(401);
		expect(await bad.text()).not.toContain("invalid-maria-fixture");
	} finally {
		await app.stop();
		await c.query("DROP TABLE IF EXISTS maria_http");
		await c.end();
	}
});
