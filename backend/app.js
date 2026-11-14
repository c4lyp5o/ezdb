import { existsSync } from "node:fs";
import path from "node:path";
import { Elysia, t } from "elysia";
import { clampPage, decodeKey } from "./keys.js";
import * as mongoAdapter from "./mongo.js";
import * as mysqlAdapter from "./mysql.js";
import * as pgAdapter from "./postgres.js";
import { createSessionStore } from "./sessions.js";
import * as sqliteAdapter from "./sqlite.js";

const HOST = process.env.EZDB_HOST || "127.0.0.1";
const PORT = Number(process.env.EZDB_PORT || 8080);
const ENGINES = new Set(["postgres", "mongo", "mysql"]);

const sql = { postgres: pgAdapter, mysql: mysqlAdapter, sqlite: sqliteAdapter };

export function createApp({ sessions = createSessionStore() } = {}) {
	async function session(cookie) {
		const handle = await sessions.get(cookie.ezdb?.value);
		if (!handle)
			throw Object.assign(new Error("Not connected"), { status: 401 });
		return handle;
	}

	return new Elysia({ prefix: "/api" })
		.onBeforeHandle(({ request, set }) => {
			const origin = request.headers.get("origin");
			if (
				request.method !== "GET" &&
				origin &&
				origin !== new URL(request.url).origin
			) {
				set.status = 403;
				return { message: "Cross-origin writes are not allowed" };
			}
		})
		.onStop(() => sessions.close())
		.onError(({ error, set, code }) => {
			const status = error.status ?? (code === "VALIDATION" ? 422 : 500);
			set.status = status;
			if (status >= 500)
				console.error(`[ezdb] ${code ?? "ERROR"}: request failed`);
			// Never echo driver internals or credentials to the client.
			return {
				message:
					code === "VALIDATION"
						? "Invalid request"
						: status < 500
							? error.message
							: "Internal error",
			};
		})
		.post(
			"/sqlite/upload",
			async ({ body, cookie, set }) => {
				if (body.trust !== "yes")
					throw Object.assign(
						new Error("Explicit server trust acknowledgement required"),
						{ status: 400 },
					);
				const client = await sqliteAdapter.uploadSQLite(body.file);
				if (cookie.ezdb?.value) await sessions.remove(cookie.ezdb.value);
				const token = sessions.create({
					engine: "sqlite",
					database: "Uploaded SQLite",
					client,
					close: () => client.close(),
				});
				cookie.ezdb.set({
					value: token,
					httpOnly: true,
					sameSite: "strict",
					path: "/api",
					maxAge: 1800,
				});
				set.status = 201;
				return {
					engine: "sqlite",
					database: "Uploaded SQLite",
					expiresAt: client.expiresAt,
				};
			},
			{
				body: t.Object({ file: t.File({ maxSize: "32m" }), trust: t.String() }),
			},
		)
		.get("/sqlite/download", async ({ cookie }) => {
			const s = await session(cookie);
			if (s.engine !== "sqlite")
				throw Object.assign(new Error("Not a SQLite session"), { status: 400 });
			return new Response(s.client.download(), {
				headers: {
					"content-type": "application/octet-stream",
					"content-disposition": 'attachment; filename="database.sqlite"',
					"cache-control": "no-store",
				},
			});
		})
		.post(
			"/connect",
			async ({ body, cookie, set }) => {
				if (!ENGINES.has(body.engine))
					throw Object.assign(new Error("Unsupported engine"), { status: 400 });
				const opts = {
					host: body.host,
					port: body.port,
					database: body.database,
					user: body.user,
					password: body.password,
				};
				let client;
				try {
					client =
						body.engine === "postgres"
							? await pgAdapter.connectPostgres(opts)
							: body.engine === "mysql"
								? await mysqlAdapter.connectMySQL(opts)
								: await mongoAdapter.connectMongo(opts);
				} catch {
					throw Object.assign(new Error("Connection failed"), { status: 401 });
				}
				const handle = {
					engine: body.engine,
					database: body.database,
					client,
					close: () =>
						body.engine !== "mongo" ? client.end() : client.close(),
				};
				if (cookie.ezdb?.value) await sessions.remove(cookie.ezdb.value);
				const token = sessions.create(handle);
				cookie.ezdb.set({
					value: token,
					httpOnly: true,
					sameSite: "strict",
					path: "/api",
					maxAge: 1800,
				});
				set.status = 201;
				return { engine: body.engine, database: body.database };
			},
			{
				body: t.Object({
					engine: t.String({ maxLength: 16 }),
					host: t.String({ minLength: 1, maxLength: 255 }),
					port: t.Numeric({ minimum: 1, maximum: 65535 }),
					database: t.String({ minLength: 1, maxLength: 128 }),
					user: t.String({ maxLength: 128 }),
					password: t.String({ maxLength: 512 }),
				}),
			},
		)
		.post("/disconnect", async ({ cookie }) => {
			const token = cookie.ezdb?.value;
			if (token) await sessions.remove(token);
			cookie.ezdb?.remove();
			return { ok: true };
		})
		.get("/session", async ({ cookie }) => {
			const s = await session(cookie);
			return { engine: s.engine, database: s.database };
		})
		.get("/tables", async ({ cookie }) => {
			const s = await session(cookie);
			const items = sql[s.engine]
				? await sql[s.engine].listTables(s.client)
				: await mongoAdapter.listCollections(s.client, s.database);
			return { items };
		})
		.get(
			"/tables/:name",
			async ({ cookie, params, query }) => {
				const s = await session(cookie);
				const page = clampPage(query);
				const data = sql[s.engine]
					? await sql[s.engine].listRows(s.client, params.name, page)
					: await mongoAdapter.listDocuments(
							s.client,
							s.database,
							params.name,
							page,
						);
				return { ...data, page: page.page, size: page.size };
			},
			{
				query: t.Object({
					page: t.Optional(t.String()),
					size: t.Optional(t.String()),
				}),
			},
		)
		.post("/tables/:name/rows", async ({ cookie, params, body, set }) => {
			const s = await session(cookie);
			set.status = 201;
			if (sql[s.engine])
				return sql[s.engine].insertRow(s.client, params.name, body);
			return mongoAdapter.insertDocument(
				s.client,
				s.database,
				params.name,
				body,
			);
		})
		.patch("/tables/:name/rows/:key", async ({ cookie, params, body }) => {
			const s = await session(cookie);
			const key = decodeKey(params.key);
			if (sql[s.engine])
				return sql[s.engine].updateRow(s.client, params.name, key, body);
			return mongoAdapter.updateDocument(
				s.client,
				s.database,
				params.name,
				key,
				body,
			);
		})
		.delete("/tables/:name/rows/:key", async ({ cookie, params }) => {
			const s = await session(cookie);
			const key = decodeKey(params.key);
			if (sql[s.engine])
				return sql[s.engine].deleteRow(s.client, params.name, key);
			return mongoAdapter.deleteDocument(
				s.client,
				s.database,
				params.name,
				key,
			);
		});
}

if (import.meta.main) {
	const distDir = path.resolve(import.meta.dir, "../frontend/dist");
	const app = new Elysia()
		.use(createApp())
		.get("/", () => Bun.file(path.join(distDir, "index.html")))
		.get("/assets/*", ({ params, set }) => {
			const rel = (params["*"] || "").replace(/^\/+/, "");
			const target = path.resolve(distDir, "assets", rel);
			if (
				!target.startsWith(path.resolve(distDir, "assets") + path.sep) ||
				!existsSync(target)
			) {
				set.status = 404;
				return "Not found";
			}
			return Bun.file(target);
		})
		.listen({ hostname: HOST, port: PORT });
	console.log(`ezdb listening on ${HOST}:${app.server?.port}`);
}
