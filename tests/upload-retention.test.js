import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { RETENTION, sweepUploads } from "../backend/sqlite.js";

test("restart-style cleanup deletes expired orphan upload and all sidecars", () => {
	const dir = path.join(tmpdir(), "ezdb-sqlite-uploads", randomUUID());
	mkdirSync(dir, { recursive: true });
	for (const file of [
		"created",
		"database.sqlite",
		"database.sqlite-wal",
		"database.sqlite-shm",
	])
		writeFileSync(path.join(dir, file), "fixture");
	const old = new Date(Date.now() - RETENTION - 1000);
	utimesSync(path.join(dir, "created"), old, old);
	sweepUploads();
	expect(existsSync(dir)).toBe(false);
});
