import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API = process.env.EZDB_API || "http://127.0.0.1:8080";

export default defineConfig({
	root: import.meta.dirname,
	plugins: [react(), tailwindcss()],
	server: { host: "127.0.0.1", port: 5173, proxy: { "/api": API } },
	build: { outDir: "dist", emptyOutDir: true },
});
