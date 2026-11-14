import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.join(tmpdir(), "ezdb-sqlite-uploads");
export const MAX_UPLOAD = 32 * 1024 * 1024;
export const RETENTION = 24 * 60 * 60 * 1000;
const active = new Map();
const fail = (message) => Object.assign(new Error(message), { status: 400 });
const quote = (s) => `"${s.replaceAll('"', '""')}"`;
export function sweepUploads(now = Date.now()) {
	mkdirSync(root, { recursive: true, mode: 0o700 });
	for (const name of readdirSync(root)) {
		if (!/^[0-9a-f-]{36}$/.test(name)) continue;
		const dir = path.join(root, name);
		if (statSync(path.join(dir, "created")).mtimeMs + RETENTION <= now) {
			active.get(dir)?.close();
			rmSync(dir, { recursive: true, force: true });
		}
	}
}
sweepUploads();
const timer = setInterval(() => sweepUploads(), 30000);
timer.unref();
export async function uploadSQLite(file) {
	if (!(file instanceof File) || file.size < 100 || file.size > MAX_UPLOAD)
		throw fail("Choose a SQLite database up to 32 MiB");
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (new TextDecoder().decode(bytes.slice(0, 16)) !== "SQLite format 3\0")
		throw fail("Not a SQLite database");
	sweepUploads();
	if (readdirSync(root).length >= 8)
		throw Object.assign(new Error("Upload capacity reached"), { status: 429 });
	const dir = path.join(root, randomUUID());
	mkdirSync(dir, { mode: 0o700 });
	writeFileSync(path.join(dir, "created"), "", { mode: 0o600 });
	const filename = path.join(dir, "database.sqlite");
	writeFileSync(filename, bytes, { mode: 0o600 });
	let db;
	try {
		db = new Database(filename, { strict: true });
		db.exec("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON;");
		if (db.query("PRAGMA quick_check").get().quick_check !== "ok")
			throw fail("Invalid database");
	} catch {
		db?.close();
		rmSync(dir, { recursive: true, force: true });
		throw fail("Invalid or unsupported SQLite database");
	}
	const client = {
		db,
		expiresAt: Date.now() + RETENTION,
		closed: false,
		close() {
			if (this.closed) return;
			this.closed = true;
			clearTimeout(deadline);
			db.close();
			active.delete(dir);
			rmSync(dir, { recursive: true, force: true });
		},
		download() {
			check(this);
			return db.serialize();
		},
	};
	const deadline = setTimeout(() => client.close(), RETENTION);
	deadline.unref();
	active.set(dir, client);
	return client;
}
function check(c) {
	if (c.closed || Date.now() >= c.expiresAt) {
		c.close();
		throw Object.assign(new Error("SQLite upload expired; upload again"), {
			status: 401,
		});
	}
}
export async function listTables(c) {
	check(c);
	return c.db
		.query(
			"SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		)
		.all()
		.map((r) => r.name);
}
async function meta(c, table) {
	check(c);
	if (!(await listTables(c)).includes(table)) throw fail("Table not found");
	const cols = c.db.query("SELECT * FROM pragma_table_xinfo(?)").all(table);
	return {
		columns: cols.map((r) => r.name),
		writable: cols.filter((r) => !r.hidden).map((r) => r.name),
		key: cols
			.filter((r) => r.pk)
			.sort((a, b) => a.pk - b.pk)
			.map((r) => r.name),
	};
}
export async function listRows(c, table, { size, offset }) {
	const { columns, key } = await meta(c, table);
	const order = key.length ? ` ORDER BY ${key.map(quote).join(",")}` : "";
	return {
		columns,
		key,
		rows: c.db
			.query(`SELECT * FROM ${quote(table)}${order} LIMIT ? OFFSET ?`)
			.all(size, offset),
		total: c.db.query(`SELECT count(*) AS total FROM ${quote(table)}`).get()
			.total,
	};
}
function values(m, data, forbidden = []) {
	if (!data || Array.isArray(data) || typeof data !== "object")
		throw fail("Expected an object");
	const entries = Object.entries(data);
	if (entries.some(([k]) => !m.writable.includes(k) || forbidden.includes(k)))
		throw fail("Unknown or read-only column");
	return entries;
}
function where(m, key) {
	if (!m.key.length || m.key.some((k) => key[k] == null))
		throw fail("A complete non-null primary key is required");
	return [
		m.key.map((k) => `${quote(k)} = ?`).join(" AND "),
		m.key.map((k) => key[k]),
	];
}
export async function insertRow(c, table, data) {
	const m = await meta(c, table),
		entries = values(m, data);
	return c.db
		.query(
			"INSERT INTO " +
				quote(table) +
				(entries.length
					? " (" +
						entries.map(([k]) => quote(k)).join(",") +
						") VALUES (" +
						entries.map(() => "?").join(",") +
						")"
					: " DEFAULT VALUES") +
				" RETURNING *",
		)
		.get(...entries.map(([, v]) => v));
}
export async function updateRow(c, table, key, data) {
	const m = await meta(c, table),
		entries = values(m, data, m.key),
		[cond, args] = where(m, key);
	if (!entries.length) throw fail("No values supplied");
	const row = c.db
		.query(
			"UPDATE " +
				quote(table) +
				" SET " +
				entries.map(([k]) => `${quote(k)} = ?`).join(",") +
				" WHERE " +
				cond +
				" RETURNING *",
		)
		.get(...entries.map(([, v]) => v), ...args);
	if (!row) throw fail("Row not found");
	return row;
}
export async function deleteRow(c, table, key) {
	const m = await meta(c, table),
		[cond, args] = where(m, key);
	const result = c.db
		.query(`DELETE FROM ${quote(table)} WHERE ${cond}`)
		.run(...args);
	if (!result.changes) throw fail("Row not found");
	return { deleted: result.changes };
}
