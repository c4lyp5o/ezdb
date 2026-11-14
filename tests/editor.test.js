import { expect, test } from "bun:test";
import { editableValues, editorPatch } from "../frontend/src/editor.js";

test("editor preserves types and sends only changed fields", () => {
	const row = {
		id: 1,
		name: "old",
		count: 3,
		active: true,
		nested: { date: { $date: { $numberLong: "0" } } },
	};
	const values = editableValues(row, { id: 1 });
	expect(values).not.toHaveProperty("id");
	expect(
		editorPatch(
			JSON.stringify({ ...values, name: "", count: 0, active: false }),
			row,
			{ id: 1 },
		),
	).toEqual({ name: "", count: 0, active: false });
	expect(editorPatch('{"name":null}', row)).toEqual({ name: null });
	expect(
		editorPatch('{"nested":{"date":{"$date":{"$numberLong":"1"}}}}', row),
	).toEqual({ nested: { date: { $date: { $numberLong: "1" } } } });
});
test("editor rejects invalid objects, key edits and no-op patches", () => {
	for (const text of ["null", "[]", "3", "{"])
		expect(() => editorPatch(text)).toThrow();
	expect(() => editorPatch('{"id":2}', { id: 1 }, { id: 1 })).toThrow(
		"read-only",
	);
	expect(() => editorPatch('{"name":"same"}', { name: "same" })).toThrow(
		"No changes",
	);
	expect(editorPatch('{"newField":[1,true,null]}')).toEqual({
		newField: [1, true, null],
	});
});
