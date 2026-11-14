import { expect, test } from "bun:test";
import { EJSON } from "bson";
import {
	connectMongo,
	deleteDocument,
	insertDocument,
	listDocuments,
	updateDocument,
} from "../backend/mongo.js";

test("Mongo BSON round-trip preserves types and distinguishes hex strings from ObjectIds", async () => {
	const client = await connectMongo({
		host: "127.0.0.1",
		port: 57017,
		database: "ezdb_test",
		user: "ezdb",
		password: process.env.MONGO_PASSWORD,
	});
	const collection = client.db("ezdb_test").collection("ezdb_types");
	try {
		await collection.deleteMany({});
		const hex = "abcdefabcdefabcdefabcdef";
		const fields = {
			date: { $date: { $numberLong: "123456789" } },
			long: { $numberLong: "9223372036854775806" },
			decimal: { $numberDecimal: "1.234567890123456789" },
			double: { $numberDouble: "1.0" },
			int: { $numberInt: "3" },
			binary: { $binary: { base64: "YWJj", subType: "00" } },
			nested: { ref: { $oid: hex } },
		};
		await insertDocument(client, "ezdb_test", "ezdb_types", {
			_id: hex,
			...fields,
		});
		await insertDocument(client, "ezdb_test", "ezdb_types", {
			_id: { $oid: hex },
			name: "object-id",
		});
		const page = await listDocuments(client, "ezdb_test", "ezdb_types", {
			offset: 0,
			size: 10,
		});
		const stringRow = page.rows.find((row) => row._id === hex);
		for (const [key, value] of Object.entries(fields))
			expect(stringRow[key]).toEqual(value);
		await updateDocument(
			client,
			"ezdb_test",
			"ezdb_types",
			{ _id: hex },
			fields,
		);
		const stored = await collection.findOne(
			{ _id: hex },
			{ promoteValues: false },
		);
		for (const [key, value] of Object.entries(fields))
			expect(EJSON.serialize(stored[key], { relaxed: false })).toEqual(value);
		await deleteDocument(client, "ezdb_test", "ezdb_types", {
			_id: { $oid: hex },
		});
		expect(await collection.countDocuments({ _id: hex })).toBe(1);
		expect(await collection.countDocuments({})).toBe(1);
		await expect(
			deleteDocument(client, "ezdb_test", "ezdb_types", { _id: { $ne: null } }),
		).rejects.toThrow("Invalid document key");
		await expect(
			updateDocument(
				client,
				"ezdb_test",
				"ezdb_types",
				{ _id: hex },
				{ _id: "changed", name: "x" },
			),
		).rejects.toThrow("read-only");
		await expect(
			updateDocument(
				client,
				"ezdb_test",
				"ezdb_types",
				{ _id: hex },
				{ "nested.ref": "x" },
			),
		).rejects.toThrow("dotted");
	} finally {
		await collection.drop();
		await client.close();
	}
});
