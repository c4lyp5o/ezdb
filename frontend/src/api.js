// Thin client for the ezdb API. Cookies carry the session; nothing is stored in the browser.
async function request(path, { method = "GET", body } = {}) {
	const res = await fetch(`/api${path}`, {
		method,
		headers: body === undefined ? {} : { "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	const data = text ? JSON.parse(text) : null;
	if (!res.ok) {
		const error = new Error(data?.message || `Request failed (${res.status})`);
		error.status = res.status;
		throw error;
	}
	return data;
}

export const api = {
	connect: (form) => request("/connect", { method: "POST", body: form }),
	disconnect: () => request("/disconnect", { method: "POST" }),
	tables: () => request("/tables"),
	rows: (name, page, size) =>
		request(`/tables/${encodeURIComponent(name)}?page=${page}&size=${size}`),
	insert: (name, data) =>
		request(`/tables/${encodeURIComponent(name)}/rows`, {
			method: "POST",
			body: data,
		}),
	update: (name, key, data) =>
		request(`/tables/${encodeURIComponent(name)}/rows/${key}`, {
			method: "PATCH",
			body: data,
		}),
	remove: (name, key) =>
		request(`/tables/${encodeURIComponent(name)}/rows/${key}`, {
			method: "DELETE",
		}),
};

// Mirrors backend/keys.js: base64url(JSON) of the key object.
export function encodeKey(obj) {
	const bytes = new TextEncoder().encode(JSON.stringify(obj));
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}
