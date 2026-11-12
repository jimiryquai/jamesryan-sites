#!/usr/bin/env node
// THROWAWAY SPIKE probe: what dialog overlays the admin, and why is the hero
// rendered as a placeholder in the frame? Dumps state for diagnosis.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4337";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
page.on("console", (m) => console.log(`[console.${m.type()}]`, m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto(`${BASE}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`, { waitUntil: "networkidle" });
await page.goto(`${BASE}/_emdash/admin/plugins/visual-editor/?id=vx-test`, { waitUntil: "domcontentloaded" });
await page.locator("iframe.vx-frame").waitFor({ timeout: 30000 });
await page.waitForTimeout(4000);

// 1. any open dialogs / portals in the admin page?
const overlays = await page.evaluate(() => {
	const out = [];
	for (const el of document.querySelectorAll("[data-open], [role=dialog], [data-base-ui-portal] > *")) {
		const r = el.getBoundingClientRect();
		out.push({ tag: el.tagName, role: el.getAttribute("role"), cls: String(el.className).slice(0, 90), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, text: el.textContent?.slice(0, 120) });
	}
	return out;
});
console.log("OVERLAYS:", JSON.stringify(overlays, null, 1).slice(0, 2500));

// 2. frame contents
const fl = page.frameLocator("iframe.vx-frame");
const keys = await fl.locator("[data-vx-key]").evaluateAll((els) => els.map((e) => ({ key: e.getAttribute("data-vx-key"), cls: e.className.slice(0, 60), tag: e.tagName })));
console.log("FRAME KEYS:", JSON.stringify(keys, null, 1));
const fields = await fl.locator("[data-vx-f]").evaluateAll((els) => els.slice(0, 20).map((e) => e.getAttribute("data-vx-f")));
console.log("FRAME FIELDS:", JSON.stringify(fields));
const status = await page.locator(".vx-status").innerText().catch(() => "(none)");
console.log("STATUS:", status);
const errs = await page.locator(".vx-err").allInnerTexts().catch(() => []);
console.log("ERRS:", JSON.stringify(errs));
await browser.close();
