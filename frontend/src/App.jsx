import { useCallback, useEffect, useRef, useState } from "react";
import { api, encodeKey } from "./api.js";
import { editableValues, editorPatch } from "./editor.js";
import Footer from "./Footer.jsx";

const DEFAULTS = {
	engine: "postgres",
	host: "127.0.0.1",
	port: 5432,
	database: "",
	user: "",
	password: "",
};
const PAGE_SIZES = [10, 25, 50, 100];

function Brand() {
	return (
		<div className="brand">
			<span className="brand-mark" aria-hidden="true">
				▤
			</span>
			<span>
				ezdb<span className="text-mute font-normal"> / workspace</span>
			</span>
		</div>
	);
}

function Connect({ onConnected }) {
	const [file, setFile] = useState(null);
	const [trust, setTrust] = useState(false);
	const [form, setForm] = useState(DEFAULTS);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(e) {
		e.preventDefault();
		setBusy(true);
		setError("");
		try {
			if (form.engine === "sqlite") {
				const body = new FormData();
				body.set("file", file);
				body.set("trust", trust ? "yes" : "no");
				const res = await fetch("/api/sqlite/upload", { method: "POST", body });
				if (!res.ok) throw new Error((await res.json()).message);
			} else await api.connect({ ...form, port: Number(form.port) });
			onConnected(form.engine, form.database);
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
			setForm((f) => ({ ...f, password: "" }));
		}
	}

	const input =
		"w-full rounded border border-line-strong bg-surface px-3 py-2 text-sm dark:border-line dark:bg-surface";
	return (
		<div className="connection-shell">
			<section className="connection-intro">
				<Brand />
				<div>
					<span className="eyebrow">DATABASE WORKSPACE</span>
					<h1>
						Your data.
						<br />A clearer view.
					</h1>
					<p>
						Tables or documents. One quiet workspace to browse, inspect and make
						precise changes.
					</p>
					<div className="engine-tags">
						<span>PostgreSQL</span>
						<span>MongoDB</span>
						<span>MySQL</span>
						<span>MariaDB</span>
						<span>SQLite</span>
					</div>
				</div>
				<p className="text-xs text-mute">
					PRIVATE BY DESIGN / NO SAVED PASSWORDS
				</p>
			</section>
			<form onSubmit={submit} className="connection-form flex flex-col gap-4">
				<div className="mb-3">
					<span className="eyebrow">CONNECTION / 01</span>
					<h2 className="mt-2 text-2xl font-semibold tracking-tight">
						Open a connection.
					</h2>
					<p className="mt-2 text-sm text-mute">
						Your database credentials. Your permissions.
					</p>
				</div>
				<label className="text-sm">
					Engine
					<select
						className={input}
						value={form.engine}
						onChange={(e) =>
							setForm({
								...form,
								engine: e.target.value,
								port:
									e.target.value === "mongo"
										? 27017
										: e.target.value === "mysql" || e.target.value === "mariadb"
											? 3306
											: 5432,
							})
						}
					>
						<option value="postgres">PostgreSQL</option>
						<option value="mongo">MongoDB</option>
						<option value="mysql">MySQL</option>
						<option value="mariadb">MariaDB</option>
						<option value="sqlite">SQLite upload</option>
					</select>
				</label>
				{form.engine === "sqlite" ? (
					<section className="rounded border border-bad p-4 flex flex-col gap-3">
						<strong className="text-bad">
							Warning: your entire database will be uploaded to this server.
						</strong>
						<p>
							Only continue if you trust this server and its operator. They can
							read all uploaded data. Changes affect the server copy, not your
							original file. Download your edited database before leaving.
						</p>
						<p>
							Uploads are deleted after 24 hours at the latest while the server
							runs, or sooner on disconnect or 30 minutes of inactivity. Restart
							cleanup removes expired abandoned files. Deletion cannot erase
							operator backups or guarantee forensic erasure. Upload a
							standalone SQLite backup, not a live WAL database. Maximum 32 MiB.
						</p>
						<label>
							SQLite database
							<input
								className={input}
								type="file"
								required
								accept=".sqlite,.sqlite3,.db"
								onChange={(e) => setFile(e.target.files[0])}
							/>
						</label>
						<label>
							<input
								type="checkbox"
								required
								checked={trust}
								onChange={(e) => setTrust(e.target.checked)}
							/>{" "}
							I trust this server and understand that my database will be
							uploaded.
						</label>
					</section>
				) : (
					<>
						<label className="text-sm">
							Host
							<input
								className={input}
								value={form.host}
								onChange={(e) => setForm({ ...form, host: e.target.value })}
								required
							/>
						</label>
						<label className="text-sm">
							Port
							<input
								className={input}
								type="number"
								value={form.port}
								onChange={(e) => setForm({ ...form, port: e.target.value })}
								required
							/>
						</label>
						<label className="text-sm">
							Database
							<input
								className={input}
								value={form.database}
								onChange={(e) => setForm({ ...form, database: e.target.value })}
								required
							/>
						</label>
						<label className="text-sm">
							User
							<input
								className={input}
								value={form.user}
								autoComplete="username"
								onChange={(e) => setForm({ ...form, user: e.target.value })}
							/>
						</label>
						<label className="text-sm">
							Password
							<input
								className={input}
								type="password"
								value={form.password}
								autoComplete="current-password"
								onChange={(e) => setForm({ ...form, password: e.target.value })}
							/>
						</label>
					</>
				)}

				{error && (
					<p role="alert" className="text-sm text-bad">
						{error}
					</p>
				)}
				<button
					type="submit"
					disabled={busy}
					className="rounded bg-accent px-3 py-2 text-sm text-accent-ink disabled:opacity-50 dark:bg-accent dark:text-accent-ink"
				>
					{busy ? "Connecting…" : "Connect"}
				</button>
				<p className="text-xs text-mute">
					Connections expire after 30 idle minutes.
				</p>
			</form>
		</div>
	);
}

function RowEditor({ table, initial, keyObj, onDone }) {
	const [text, setText] = useState(() =>
		JSON.stringify(editableValues(initial, keyObj ?? {}), null, 2),
	);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	async function save(event) {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setError("");
		try {
			const data = editorPatch(text, initial, keyObj ?? {});
			if (keyObj) await api.update(table, encodeKey(keyObj), data);
			else await api.insert(table, data);
			onDone();
		} catch (err) {
			setError(err.message);
		} finally {
			setBusy(false);
		}
	}
	return (
		<form onSubmit={save} className="flex flex-col gap-2">
			<label htmlFor="record-json">
				Record values (JSON / MongoDB canonical Extended JSON)
			</label>
			<p className="text-sm">
				Keys are read-only. Omitted fields stay unchanged; null clears a value.
				Empty inserts use database defaults.
			</p>
			<textarea
				id="record-json"
				rows={10}
				value={text}
				onChange={(e) => setText(e.target.value)}
				className="w-full rounded border p-2 font-mono text-sm"
				spellCheck={false}
			/>
			{error && (
				<p role="alert" className="text-sm text-bad">
					{error}
				</p>
			)}
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={busy}
					className="rounded bg-accent px-3 py-1 text-accent-ink dark:bg-accent dark:text-accent-ink"
				>
					{busy ? "Saving…" : "Save"}
				</button>
				<button
					type="button"
					disabled={busy}
					onClick={onDone}
					className="rounded border px-3 py-1"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function DeleteDialog({ target, onCancel, onDelete }) {
	const ref = useRef(null);
	useEffect(() => {
		const previous = document.activeElement;
		ref.current.showModal();
		ref.current.querySelector("button").focus();
		return () => previous?.focus();
	}, []);
	return (
		<dialog
			ref={ref}
			onKeyDown={(event) => {
				if (event.key !== "Tab") return;
				const buttons = [...ref.current.querySelectorAll("button")];
				const index = buttons.indexOf(document.activeElement);
				event.preventDefault();
				buttons[
					(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
				].focus();
			}}
			aria-labelledby="delete-title"
			onCancel={onCancel}
			className="m-auto w-full max-w-sm rounded bg-surface p-4 text-sm backdrop:bg-black/40 dark:bg-surface"
		>
			<h2 id="delete-title">Delete this row permanently?</h2>
			<pre className="my-3 overflow-x-auto">{JSON.stringify(target)}</pre>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded border px-3 py-2"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onDelete}
					className="rounded bg-bad px-3 py-2 text-accent-ink"
				>
					Delete
				</button>
			</div>
		</dialog>
	);
}

function Browser({ onDisconnect, engine, database }) {
	const [tables, setTables] = useState([]);
	const [table, setTable] = useState(null);
	const requestId = useRef(0);
	const [data, setData] = useState(null);
	const [page, setPage] = useState(1);
	const [size, setSize] = useState(25);
	const [editing, setEditing] = useState(null); // { keyObj, row } | "new" | null
	const [confirming, setConfirming] = useState(null);
	const [error, setError] = useState("");

	useEffect(() => {
		api
			.tables()
			.then((r) => setTables(r.items))
			.catch((e) => setError(e.message));
	}, []);

	const load = useCallback(async () => {
		if (!table) return;
		const id = ++requestId.current;
		setData(null);
		try {
			const result = await api.rows(table, page, size);
			if (id !== requestId.current) return;
			if (page > 1 && result.rows.length === 0) {
				setPage(page - 1);
				return;
			}
			setData(result);
			setError("");
		} catch (e) {
			if (id === requestId.current) setError(e.message);
		}
	}, [table, page, size]);

	useEffect(() => {
		load();
		return () => {
			requestId.current++;
		};
	}, [load]);

	function rowKey(row) {
		const keyCols = data?.key ?? [];
		return Object.fromEntries(keyCols.map((c) => [c, row[c]]));
	}

	async function doDelete() {
		const target = confirming;
		setConfirming(null);
		try {
			await api.remove(table, encodeKey(target));
			await load();
		} catch (e) {
			setError(e.message);
		}
	}

	async function logout() {
		await api.disconnect().catch(() => {});
		onDisconnect();
	}

	const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
	const columns = data?.columns ?? [
		...new Set(data?.rows.flatMap(Object.keys) ?? []),
	];
	const canEdit = data && data.key?.length > 0;

	return (
		<div className="flex min-h-screen flex-col md:flex-row">
			<aside className="workspace-nav border-b p-5 md:w-64 md:border-r md:border-b-0">
				<Brand />
				<div className="eyebrow mt-10 mb-3">
					CONNECTED / {engine.toUpperCase()}
				</div>
				<div className="mb-2 flex items-center justify-between text-sm font-semibold">
					<span>{database}</span>
					<button type="button" onClick={logout} className="text-xs underline">
						Disconnect
					</button>
				</div>
				{engine === "sqlite" && (
					<a href="/api/sqlite/download" className="text-sm underline">
						Download edited SQLite database
					</a>
				)}
				<p className="eyebrow mt-8 mb-3">
					{engine === "mongo" ? "COLLECTIONS" : "TABLES"} / {tables.length}
				</p>
				<ul className="flex flex-wrap gap-1 md:flex-col">
					{tables.map((t) => (
						<li key={t}>
							<button
								type="button"
								onClick={() => {
									if (t === table && page === 1) {
										load();
										return;
									}
									requestId.current++;
									setData(null);
									setTable(t);
									setPage(1);
									setEditing(null);
									setConfirming(null);
								}}
								className={`rounded px-2 py-1 text-left text-sm ${table === t ? "bg-accent-dim dark:bg-accent-dim" : ""}`}
							>
								{t}
							</button>
						</li>
					))}
				</ul>
			</aside>
			<main className="workspace-main min-w-0 flex-1 overflow-x-auto p-4 md:p-8">
				{error && (
					<p role="alert" className="mb-3 text-sm text-bad">
						{error}
					</p>
				)}
				{!table && (
					<p className="text-sm text-mute">
						Choose a {engine === "mongo" ? "collection" : "table"}.
					</p>
				)}
				{table && data && (
					<>
						<div className="mb-3 flex flex-wrap items-center gap-2">
							<h2 className="text-2xl font-semibold tracking-tight">{table}</h2>
							<span className="text-sm text-mute">{data.total} rows</span>
							<button
								type="button"
								onClick={() => setEditing("new")}
								className="ml-auto rounded bg-accent px-3 py-1 text-sm text-accent-ink dark:bg-accent dark:text-accent-ink"
							>
								Add
							</button>
						</div>

						{editing && (
							<div className="mb-4 rounded border p-3">
								<RowEditor
									table={table}
									key={editing === "new" ? "new" : encodeKey(editing.keyObj)}
									initial={editing === "new" ? null : editing.row}
									keyObj={editing === "new" ? null : editing.keyObj}
									onDone={() => {
										setEditing(null);
										load();
									}}
								/>
							</div>
						)}

						<p className="mb-2 text-xs text-mute md:hidden">
							Scroll the table horizontally to see additional fields and row
							actions.
						</p>
						<table className="w-full border-collapse text-sm">
							<thead>
								<tr className="text-left">
									{columns.map((c) => (
										<th key={c} className="border-b px-2 py-1 font-medium">
											{c}
										</th>
									))}
									<th className="border-b px-2 py-1 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{data.rows.map((row) => (
									<tr key={JSON.stringify(row)} className="border-b">
										{columns.map((c) => (
											<td
												key={c}
												className="max-w-xs truncate px-2 py-1 align-top font-mono text-xs"
											>
												{row[c] === null ? (
													<span className="text-mute">null</span>
												) : typeof row[c] === "object" ? (
													JSON.stringify(row[c])
												) : (
													String(row[c])
												)}
											</td>
										))}
										<td className="whitespace-nowrap px-2 py-1 text-right">
											{canEdit && (
												<>
													<button
														type="button"
														onClick={() =>
															setEditing({ keyObj: rowKey(row), row })
														}
														className="mr-2 row-action"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => setConfirming(rowKey(row))}
														className="text-bad row-action"
													>
														Delete
													</button>
												</>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>

						<div className="mt-3 flex items-center gap-2 text-sm">
							<button
								type="button"
								disabled={page <= 1}
								onClick={() => setPage(page - 1)}
								className="rounded border px-2 py-1 disabled:opacity-40"
							>
								Prev
							</button>
							<span>
								Page {page} / {pages}
							</span>
							<button
								type="button"
								disabled={page >= pages}
								onClick={() => setPage(page + 1)}
								className="rounded border px-2 py-1 disabled:opacity-40"
							>
								Next
							</button>
							<select
								value={size}
								onChange={(e) => {
									setSize(Number(e.target.value));
									setPage(1);
								}}
								className="ml-auto rounded border px-2 py-1"
							>
								{PAGE_SIZES.map((n) => (
									<option key={n} value={n}>
										{n} / page
									</option>
								))}
							</select>
						</div>
					</>
				)}

				{confirming && (
					<DeleteDialog
						target={confirming}
						onCancel={() => setConfirming(null)}
						onDelete={doDelete}
					/>
				)}
			</main>
		</div>
	);
}

export default function App() {
	const [session, setSession] = useState(null);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		fetch("/api/session")
			.then(async (res) => {
				if (res.ok) setSession(await res.json());
			})
			.catch(() => {})
			.finally(() => setReady(true));
	}, []);
	if (!ready) return <p className="p-4">Checking connection…</p>;
	return (
		<div className="app-shell">
			<div className="app-content">
				{session ? (
					<Browser
						engine={session.engine}
						database={session.database}
						onDisconnect={() => setSession(null)}
					/>
				) : (
					<Connect
						onConnected={(engine, database) => setSession({ engine, database })}
					/>
				)}
			</div>
			<Footer />
		</div>
	);
}
