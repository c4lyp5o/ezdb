import pg from "pg";
import { quoteIdentifier } from "./sql-identifiers.js";

// Postgres adapter. Every identifier is validated against information_schema before
// it is quoted; every value is a bound parameter.
export async function connectPostgres({
	host,
	port,
	database,
	user,
	password,
}) {
	const client = new pg.Client({
		host,
		port,
		database,
		user,
		password,
		connectionTimeoutMillis: 5000,
		statement_timeout: 15000,
	});
	try {
		await client.connect();
		return client;
	} catch (error) {
		await client.end();
		throw error;
	}
}

export async function listTables(client) {
	const { rows } = await client.query(
		`SELECT table_name FROM information_schema.tables
		 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		 ORDER BY table_name`,
	);
	return rows.map((r) => r.table_name);
}

async function tableColumns(client, table) {
	const { rows } = await client.query(
		`SELECT column_name FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name = $1
		 ORDER BY ordinal_position`,
		[table],
	);
	if (rows.length === 0) throw notFound("Table not found");
	return rows.map((r) => r.column_name);
}

async function primaryKey(client, table) {
	const { rows } = await client.query(
		`SELECT a.attname AS column_name
		 FROM pg_index i
		 JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		 WHERE i.indrelid = format('public.%I', $1::text)::regclass AND i.indisprimary
		 ORDER BY array_position(i.indkey, a.attnum)`,
		[table],
	);
	return rows.map((r) => r.column_name);
}

function notFound(message) {
	const error = new Error(message);
	error.status = 404;
	return error;
}

export async function listRows(client, table, { offset, size }) {
	const columns = await tableColumns(client, table);
	const pk = await primaryKey(client, table);
	const order = pk.length
		? `ORDER BY ${pk.map(quoteIdentifier).join(", ")}`
		: "";
	const [{ rows }, { rows: count }] = await Promise.all([
		client.query(
			`SELECT * FROM ${quoteIdentifier(table)} ${order} LIMIT $1 OFFSET $2`,
			[size, offset],
		),
		client.query(
			`SELECT count(*)::int AS total FROM ${quoteIdentifier(table)}`,
		),
	]);
	return { columns, key: pk, rows, total: count[0].total };
}

function pickKey(pk, key) {
	const missing = pk.filter((c) => !(c in key));
	if (pk.length === 0)
		throw Object.assign(
			new Error("Table has no primary key; editing is disabled"),
			{ status: 400 },
		);
	if (missing.length)
		throw Object.assign(new Error("Row key is incomplete"), { status: 400 });
	return pk.map((c) => [c, key[c]]);
}

function assignColumns(columns, data, forbidden = []) {
	const entries = Object.entries(data ?? {}).filter(
		([c]) => columns.includes(c) && !forbidden.includes(c),
	);
	if (entries.length !== Object.keys(data ?? {}).length) {
		throw Object.assign(new Error("Unknown or read-only column in request"), {
			status: 400,
		});
	}
	return entries;
}

export async function insertRow(client, table, data) {
	const columns = await tableColumns(client, table);
	const entries = assignColumns(columns, data);
	if (entries.length === 0) {
		const { rows } = await client.query(
			`INSERT INTO ${quoteIdentifier(table)} DEFAULT VALUES RETURNING *`,
		);
		return rows[0];
	}
	const names = entries.map(([c]) => quoteIdentifier(c)).join(", ");
	const params = entries.map((_, i) => `$${i + 1}`).join(", ");
	const { rows } = await client.query(
		`INSERT INTO ${quoteIdentifier(table)} (${names}) VALUES (${params}) RETURNING *`,
		entries.map(([, v]) => v),
	);
	return rows[0];
}

export async function updateRow(client, table, key, data) {
	const columns = await tableColumns(client, table);
	const pk = await primaryKey(client, table);
	const where = pickKey(pk, key);
	const entries = assignColumns(columns, data, pk);
	if (entries.length === 0)
		throw Object.assign(new Error("No values supplied"), { status: 400 });
	const sets = entries
		.map(([c], i) => `${quoteIdentifier(c)} = $${i + 1}`)
		.join(", ");
	const cond = where
		.map(([c], i) => `${quoteIdentifier(c)} = $${entries.length + i + 1}`)
		.join(" AND ");
	const { rows } = await client.query(
		`UPDATE ${quoteIdentifier(table)} SET ${sets} WHERE ${cond} RETURNING *`,
		[...entries.map(([, v]) => v), ...where.map(([, v]) => v)],
	);
	if (rows.length === 0) throw notFound("Row not found");
	return rows[0];
}

export async function deleteRow(client, table, key) {
	await tableColumns(client, table);
	const pk = await primaryKey(client, table);
	const where = pickKey(pk, key);
	const cond = where
		.map(([c], i) => `${quoteIdentifier(c)} = $${i + 1}`)
		.join(" AND ");
	const { rowCount } = await client.query(
		`DELETE FROM ${quoteIdentifier(table)} WHERE ${cond}`,
		where.map(([, v]) => v),
	);
	if (rowCount === 0) throw notFound("Row not found");
	return { deleted: rowCount };
}
