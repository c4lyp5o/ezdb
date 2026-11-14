import { expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import pg from "pg";
import {
	connectMongo,
	insertDocument,
	listDocuments,
} from "../backend/mongo.js";
import { connectPostgres, insertRow, listRows } from "../backend/postgres.js";

test("Postgres read-only login can browse but cannot insert", async () => {
	const config = {
		host: "127.0.0.1",
		port: 55432,
		database: "ezdb_test",
		user: "postgres",
		password: process.env.PG_PASSWORD,
	};
	const admin = new pg.Client(config);
	await admin.connect();
	const password = crypto.randomUUID();
	let reader;
	try {
		await admin.query("CREATE ROLE ezdb_reader LOGIN");
		await admin.query(`ALTER ROLE ezdb_reader PASSWORD '${password}'`);
		await admin.query("CREATE TABLE ezdb_permissions (id int PRIMARY KEY)");
		await admin.query("GRANT USAGE ON SCHEMA public TO ezdb_reader");
		await admin.query("GRANT SELECT ON ezdb_permissions TO ezdb_reader");
		reader = await connectPostgres({
			...config,
			user: "ezdb_reader",
			password,
		});
		expect(
			(await listRows(reader, "ezdb_permissions", { offset: 0, size: 10 }))
				.total,
		).toBe(0);
		await expect(
			insertRow(reader, "ezdb_permissions", { id: 1 }),
		).rejects.toMatchObject({ code: "42501" });
	} finally {
		await reader?.end();
		await admin.query("DROP TABLE IF EXISTS ezdb_permissions");
		await admin.query("DROP OWNED BY ezdb_reader");
		await admin.query("DROP ROLE ezdb_reader");
		await admin.end();
	}
});

test("Mongo read-only login can browse but cannot insert", async () => {
	const admin = new MongoClient("mongodb://127.0.0.1:57017", {
		auth: { username: "ezdb", password: process.env.MONGO_PASSWORD },
		authSource: "admin",
	});
	await admin.connect();
	const db = admin.db("ezdb_test");
	const password = crypto.randomUUID();
	let reader;
	try {
		await db.collection("ezdb_permissions").insertOne({ check: true });
		await admin.db("admin").command({
			createUser: "ezdb_reader",
			pwd: password,
			roles: [{ role: "read", db: "ezdb_test" }],
		});
		reader = await connectMongo({
			host: "127.0.0.1",
			port: 57017,
			database: "ezdb_test",
			user: "ezdb_reader",
			password,
			authSource: "ezdb_test",
		});
		expect(
			(
				await listDocuments(reader, "ezdb_test", "ezdb_permissions", {
					offset: 0,
					size: 10,
				})
			).total,
		).toBe(1);
		await expect(
			insertDocument(reader, "ezdb_test", "ezdb_permissions", { check: false }),
		).rejects.toMatchObject({ code: 13 });
	} finally {
		await reader?.close();
		await admin.db("admin").command({ dropUser: "ezdb_reader" });
		await db.collection("ezdb_permissions").drop();
		await admin.close();
	}
});
