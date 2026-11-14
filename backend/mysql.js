import mysql from "mysql2/promise";

const fail = (message) => Object.assign(new Error(message), { status: 400 });
const quote = (s) => `\`${s.replaceAll("`", "``")}\``;
export async function connectMySQL(opts) {
	return mysql.createConnection({
		...opts,
		connectTimeout: 5000,
		multipleStatements: false,
		supportBigNumbers: true,
		bigNumberStrings: true,
		dateStrings: true,
	});
}
export async function listTables(c) {
	const [rows] = await c.execute(
		"SELECT TABLE_NAME AS name FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
	);
	return rows.map((r) => r.name);
}
async function meta(c, table) {
	if (!(await listTables(c)).includes(table)) throw fail("Table not found");
	const [rows] = await c.execute(
		"SELECT COLUMN_NAME AS name, COLUMN_KEY AS kind, EXTRA AS extra FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",
		[table],
	);
	return {
		columns: rows.map((r) => r.name),
		writable: rows
			.filter((r) => !r.extra.includes("GENERATED"))
			.map((r) => r.name),
		key: rows.filter((r) => r.kind === "PRI").map((r) => r.name),
	};
}
export async function listRows(c, table, { size, offset }) {
	const { columns, key } = await meta(c, table);
	const [rows] = await c.execute(
		"SELECT * FROM " +
			quote(table) +
			(key.length ? ` ORDER BY ${key.map(quote).join(",")}` : "") +
			" LIMIT ? OFFSET ?",
		[String(size), String(offset)],
	);
	const [count] = await c.execute(
		`SELECT count(*) AS total FROM ${quote(table)}`,
	);
	return { columns, key, rows, total: Number(count[0].total) };
}
function values(m, data, forbidden = []) {
	if (!data || typeof data !== "object" || Array.isArray(data))
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
	await c.execute(
		"INSERT INTO " +
			quote(table) +
			" (" +
			entries.map(([k]) => quote(k)).join(",") +
			") VALUES (" +
			entries.map(() => "?").join(",") +
			")",
		entries.map(([, v]) => v),
	);
	return { inserted: 1 };
}
export async function updateRow(c, table, key, data) {
	const m = await meta(c, table),
		entries = values(m, data, m.key),
		[cond, args] = where(m, key);
	if (!entries.length) throw fail("No values supplied");
	const [result] = await c.execute(
		"UPDATE " +
			quote(table) +
			" SET " +
			entries.map(([k]) => `${quote(k)} = ?`).join(",") +
			" WHERE " +
			cond,
		[...entries.map(([, v]) => v), ...args],
	);
	if (!result.affectedRows) throw fail("Row not found");
	return { updated: result.affectedRows };
}
export async function deleteRow(c, table, key) {
	const m = await meta(c, table),
		[cond, args] = where(m, key);
	const [result] = await c.execute(
		`DELETE FROM ${quote(table)} WHERE ${cond}`,
		args,
	);
	if (!result.affectedRows) throw fail("Row not found");
	return { deleted: result.affectedRows };
}
