import { EJSON } from "bson";
import { MongoClient } from "mongodb";

// MongoDB adapter. Rows are documents addressed by _id only.
function toId(value) {
	try {
		const id = EJSON.deserialize(value, { relaxed: false });
		const hasOperator = (v) =>
			v &&
			typeof v === "object" &&
			Object.entries(v).some(
				([k, child]) => k.startsWith("$") || hasOperator(child),
			);
		if (hasOperator(id)) throw new Error("operator");
		return id;
	} catch {
		throw Object.assign(new Error("Invalid document key"), { status: 400 });
	}
}

function parseValues(data) {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw Object.assign(new Error("Document must be an object"), {
			status: 400,
		});
	}
	if (
		Object.keys(data).some((key) => key.startsWith("$") || key.includes("."))
	) {
		throw Object.assign(
			new Error("Operator and dotted field names are not supported"),
			{ status: 400 },
		);
	}
	try {
		return EJSON.deserialize(data, { relaxed: false });
	} catch {
		throw Object.assign(new Error("Invalid Extended JSON"), { status: 400 });
	}
}

function notFound(message) {
	const error = new Error(message);
	error.status = 404;
	return error;
}

export async function connectMongo({ host, port, database, user, password }) {
	const auth = user
		? `${encodeURIComponent(user)}:${encodeURIComponent(password ?? "")}@`
		: "";
	const client = new MongoClient(
		`mongodb://${auth}${host}:${port}/${database}?authSource=${user ? "admin" : database}`,
		{
			serverSelectionTimeoutMS: 5000,
		},
	);
	try {
		await client.connect();
		return client;
	} catch (error) {
		await client.close();
		throw error;
	}
}

export async function listCollections(client, database) {
	const names = await client
		.db(database)
		.listCollections({}, { nameOnly: true })
		.toArray();
	return names.map((c) => c.name).sort();
}

export async function listDocuments(
	client,
	database,
	collection,
	{ offset, size },
) {
	const coll = client.db(database).collection(collection);
	const [docs, total] = await Promise.all([
		coll
			.find({}, { promoteValues: false })
			.sort({ _id: 1 })
			.skip(offset)
			.limit(size)
			.toArray(),
		coll.estimatedDocumentCount(),
	]);
	// Canonical EJSON preserves BSON types, including ObjectId versus hex-string IDs.
	const rows = docs.map((doc) => EJSON.serialize(doc, { relaxed: false }));
	return { key: ["_id"], rows, total };
}

export async function insertDocument(client, database, collection, data) {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw Object.assign(new Error("Document must be a JSON object"), {
			status: 400,
		});
	}
	const doc = parseValues(data);
	const { insertedId } = await client
		.db(database)
		.collection(collection)
		.insertOne(doc);
	return { insertedId: EJSON.serialize(insertedId, { relaxed: true }) };
}

export async function updateDocument(client, database, collection, key, data) {
	const id = toId(key._id);
	if (id === undefined)
		throw Object.assign(new Error("Row key is incomplete"), { status: 400 });
	const set = parseValues(data);
	if ("_id" in set)
		throw Object.assign(new Error("_id is read-only"), { status: 400 });
	if (Object.keys(set).length === 0)
		throw Object.assign(new Error("No values supplied"), { status: 400 });
	const res = await client
		.db(database)
		.collection(collection)
		.updateOne({ _id: id }, { $set: set });
	if (res.matchedCount === 0) throw notFound("Row not found");
	return { modified: res.modifiedCount };
}

export async function deleteDocument(client, database, collection, key) {
	const id = toId(key._id);
	if (id === undefined)
		throw Object.assign(new Error("Row key is incomplete"), { status: 400 });
	const res = await client
		.db(database)
		.collection(collection)
		.deleteOne({ _id: id });
	if (res.deletedCount === 0) throw notFound("Row not found");
	return { deleted: res.deletedCount };
}
