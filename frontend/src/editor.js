export function editableValues(row = {}, key = {}) {
	return Object.fromEntries(
		Object.entries(row ?? {}).filter(([name]) => !(name in key)),
	);
}

// Updates are patches: omitted fields are unchanged; use null to clear a value.
export function editorPatch(text, initial, key = {}) {
	const values = JSON.parse(text);
	if (!values || typeof values !== "object" || Array.isArray(values)) {
		throw new Error("Enter a JSON object");
	}
	for (const name of Object.keys(values)) {
		if (name in key) throw new Error("Primary keys are read-only");
	}
	if (!initial) return values;
	const patch = Object.fromEntries(
		Object.entries(values).filter(
			([name, value]) =>
				JSON.stringify(value) !== JSON.stringify(initial[name]),
		),
	);
	if (!Object.keys(patch).length) throw new Error("No changes supplied");
	return patch;
}
