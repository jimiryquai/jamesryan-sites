import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { sqlite } from "emdash/db";
import node from "@astrojs/node";
import { codeBlockProPlugin } from "./src/index.ts";

export default defineConfig({
	site: "http://localhost:4323",
	output: "server",
	adapter: node({
		mode: "standalone"
	}),
	server: {
		port: 4323,
	},
	vite: {
		server: {
			fs: {
				allow: [".."]
			}
		}
	},
	integrations: [
		react(),
		emdash({
			database: sqlite({ url: "file:./sandbox.db" }),
			plugins: [
				codeBlockProPlugin()
			]
		})
	]
});

