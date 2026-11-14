import { expect, test } from "bun:test";
import { quoteIdentifier } from "../backend/sql-identifiers.js";

test("quotes identifiers without allowing SQL injection", () => {
	expect(quoteIdentifier('a"; DROP TABLE users;--')).toBe(
		'"a""; DROP TABLE users;--"',
	);
});

test("rejects empty, non-string and NUL identifiers", () => {
	for (const value of ["", null, "a\0b"])
		expect(() => quoteIdentifier(value)).toThrow();
});
