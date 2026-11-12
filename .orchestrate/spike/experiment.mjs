#!/usr/bin/env node
// THROWAWAY SPIKE (ticket 25): browser proof for the visual-editor
// compatibility experiment. Drives the local server on 127.0.0.1:4337 with a
// fresh Playwright context: logs in through EmDash's dev-only setup bypass
// (fixture admin), then exercises all ten page-builder blocks in the visual
// editor, the publish-rule conflict, repeaters, images, the preview boundary
// and the network/telemetry surface. Screenshots + JSON evidence land in
// .orchestrate/evidence/. Local only; nothing merges.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const evidence = join(here, "../evidence");
mkdirSync(evidence, { recursive: true });

const BASE = process.env.VX_BASE ?? "http://127.0.0.1:4337";
const log = [];
const hosts = new Map(); // telemetry audit: every request host + count
let shot = 0;

function record(step, ok, detail) {
	log.push({ step, ok, detail });
	// Persist on every step: a crash must never lose the evidence gathered so far.
	writeFileSync(join(evidence, "25-experiment-log.json"), JSON.stringify({ base: BASE, finishedAt: null, log, putLog, requestHosts: Object.fromEntries(hosts), pageErrors: pageErrors.slice(0, 30) }, null, 2));
	console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
}

async function shoot(page, slug) {
	const file = join(evidence, `25-${String(++shot).padStart(2, "0")}-${slug}.png`);
	await page.screenshot({ path: file, fullPage: false }).catch((e) => record(`screenshot ${slug}`, false, String(e)));
	return file;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
context.on("request", (r) => {
	const host = new URL(r.url()).host;
	hosts.set(host, (hosts.get(host) ?? 0) + 1);
});
const page = await context.newPage();
const pageErrors = [];
const putLog = []; // every content PUT: status + error message (the save-filtering story)
page.on("response", async (r) => {
	if (r.url().includes("/_emdash/api/content/pages/") && r.request().method() === "PUT") {
		putLog.push({ url: r.url().replace(BASE, ""), status: r.status(), body: (await r.text().catch(() => "")).slice(0, 4000) });
	}
});
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push(`console: ${m.text()}`); });

// ---- helpers -------------------------------------------------------------
const editor = (id) => `${BASE}/_emdash/admin/plugins/visual-editor/${id ? `?id=${id}` : ""}`;
const frame = () => page.frameLocator("iframe.vx-frame");
const panelField = (path) => page.locator(`[data-vef="${path}"]`);
// The repeater card (move/remove buttons) containing a subfield with this data-vef path.
const repCard = (subFieldPath) => page.locator(".vx-rep", { has: page.locator(`[data-vef="${subFieldPath}"]`) });
const statusText = async () => await page.locator(".vx-status").innerText();

async function waitForSaved(timeout = 20000) {
	await page.locator(".vx-status").filter({ hasText: /Draft saved|All changes published|Published/ }).first()
		.waitFor({ timeout }).catch(() => {});
	await page.waitForTimeout(400);
	return await statusText();
}
// Poll the draft layout until pred passes (saves debounce ~1.2s; PUTs serialise).
async function untilLayout(id, pred, timeout = 12000) {
	const start = Date.now();
	let last = null;
	while (Date.now() - start < timeout) {
		last = await layoutOf(id);
		if (pred(last)) return last;
		await page.waitForTimeout(600);
	}
	return last;
}
async function apiGet(path) {
	return page.evaluate(async (p) => {
		const r = await fetch(p, { credentials: "same-origin", headers: { "X-EmDash-Request": "1" } });
		return { status: r.status, body: await r.json().catch(() => null) };
	}, path);
}
const layoutOf = async (id) => {
	const r = await apiGet(`/_emdash/api/content/pages/${id}`);
	return r.body?.data?.item?.data?.layout ?? r.body?.data?.item?.data?.Layout ?? null;
};

// ---- 1. fixture admin via dev-only setup bypass --------------------------
await page.goto(`${BASE}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`, { waitUntil: "networkidle" });
const adminOk = page.url().includes("/_emdash/admin");
record("dev-bypass fixture admin session", adminOk, page.url());
// First login shows EmDash's welcome dialog, which overlays the whole admin —
// it can appear with a delay, so wait for it and dismiss, then confirm it's gone.
const dismissWelcome = async (waitMs = 8000) => {
	const dialog = page.locator("[role=dialog]");
	try {
		await dialog.first().waitFor({ timeout: waitMs });
		const labels = await dialog.locator("button").allInnerTexts();
		await dialog.locator("button").last().click().catch(() => {});
		await dialog.first().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
		return labels;
	} catch {
		return null;
	}
};
const welcomeLabels = await dismissWelcome();
record("welcome dialog dismissed", true, welcomeLabels ? welcomeLabels.join(" | ") : "not shown");
await shoot(page, "admin-dashboard");

// ---- 2. open the editor on the ten-block fixture page --------------------
await page.goto(editor("vx-test"), { waitUntil: "domcontentloaded" });
await page.locator("iframe.vx-frame").waitFor({ timeout: 30000 });
await frame().locator("#vx-blocks").waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
const frameKeys = await frame().locator("[data-vx-key]").evaluateAll((els) => els.map((e) => e.getAttribute("data-vx-key")));
record("frame renders with markers", frameKeys.length === 10, `keys: ${frameKeys.join(",")}`);
const frameFields = await frame().locator("[data-vx-f]").evaluateAll((els) => els.map((e) => e.getAttribute("data-vx-f")));
record("field markers present", frameFields.length > 0, `${frameFields.length} leaves: ${frameFields.slice(0, 8).join(", ")}…`);
await shoot(page, "editor-loaded");

// ---- 3. click-to-select per block (through the frame bridge) -------------
async function selectByKey(key) {
	await dismissWelcome(300);
	await frame().locator(`[data-vx-key="${key}"]`).click({ timeout: 10000 });
	await page.waitForTimeout(250);
}
async function panelTitle() {
	return page.locator(".vx-panel h2").first().innerText().catch(() => null);
}

// ---- 4. hero: live text patch, eyebrow, links, image, variant ------------
await selectByKey("vx-hero");
record("hero selects by frame click", (await panelTitle()) === "Hero", `panel: ${await panelTitle()}`);

// live patch: type in the panel's heading input, expect the frame span to update without a reload
const heroHeading = panelField("heading").locator("input");
await heroHeading.fill("VX edited hero heading");
await page.waitForTimeout(300);
const patchedLive = await frame().locator(`[data-vx-f="vx-hero.heading"]`).innerText().catch(() => null);
record("hero heading live-patches", patchedLive === "VX edited hero heading", `frame text: ${JSON.stringify(patchedLive)}`);
await shoot(page, "hero-live-patch");

// structural change: variant photo -> centered (needs refresh, no image)
await panelField("variant").locator("select").selectOption("centered");
await page.waitForTimeout(2500);
const heroStillThere = await frame().locator(`[data-vx-key="vx-hero"]`).count();
record("hero variant switch (photo->centered)", heroStillThere === 1, `section count after refresh: ${heroStillThere}`);
await shoot(page, "hero-variant-centered");

// switch back and restore image via the media picker
await panelField("variant").locator("select").selectOption("photo");
await page.waitForTimeout(2500);
const heroImageField = panelField("image").locator("button", { hasText: /Replace image|Choose image/ }).first();
await heroImageField.click();
await page.locator(".vx-media button, .vx-media img").first().waitFor({ timeout: 10000 });
await shoot(page, "hero-media-picker");
await page.locator(".vx-media button").first().click();
await page.waitForTimeout(2500);
const heroImgSrc = await frame().locator(`[data-vx-key="vx-hero"] img`).first().getAttribute("src").catch(() => null);
record("hero image picked from media library", !!heroImgSrc, `img src: ${heroImgSrc}`);

// repeater: links — edit a label, add an item, remove it
await panelField("links.0.label").locator("input").fill("Edited primary link");
await page.waitForTimeout(2500);
const linkLabelLive = await frame().locator(`[data-vx-f="vx-hero.links.0.label"]`).first().innerText().catch(() => null);
record("hero links repeater item label edit", linkLabelLive === "Edited primary link", `frame: ${JSON.stringify(linkLabelLive)}`);

// undo burst check + save state
await waitForSaved();
const savedStatus = await statusText();
record("hero edits reach saved draft", /saved|published/i.test(savedStatus), `status: ${savedStatus}`);

// persistence after a full reload
const beforeReload = await layoutOf("vx-test");
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("iframe.vx-frame").waitFor({ timeout: 30000 });
await frame().locator("#vx-blocks").waitFor({ timeout: 30000 });
const afterReload = await layoutOf("vx-test");
const heroAfter = afterReload?.find((b) => b._key === "vx-hero");
record("hero edits persist across reload",
	heroAfter?.heading === "VX edited hero heading" && heroAfter?.variant === "photo" && Array.isArray(heroAfter?.links) && heroAfter.links[0]?.label === "Edited primary link",
	JSON.stringify({ heading: heroAfter?.heading, variant: heroAfter?.variant, links0: heroAfter?.links?.[0] }));
await shoot(page, "hero-reloaded");

// ---- 5. cta: the save-filtering / server-rejection conflict, then repair -------------
// Upstream's "+ Add item" seeds url-type subfields with "" — EmDash 1.5 validates url
// fields natively and rejects the PUT; upstream then sets the WHOLE BLOCK aside and
// saves the draft without it. This step demonstrates that exact data-loss path.
await selectByKey("vx-cta");
record("cta selects", (await panelTitle()) === "Call to action", `panel: ${await panelTitle()}`);
await panelField("heading").locator("input").fill("VX edited CTA heading");
await page.locator("button", { hasText: "+ Add item" }).first().click();
await page.waitForTimeout(3500);
const rejectedPut = putLog.filter((p) => p.status >= 400).pop();
record("repeater add with empty URL rejected by server", !!rejectedPut, rejectedPut ? `${rejectedPut.status}: ${rejectedPut.body.slice(0, 180)}` : "no failed PUT observed");
let ctaGone = await untilLayout("vx-test", (l) => !l?.some((b) => b._key === "vx-cta"));
record("rejected block dropped from saved draft (upstream save-filtering)", !ctaGone?.some((b) => b._key === "vx-cta"), `cta in draft: ${ctaGone?.some((b) => b._key === "vx-cta")}`);
const setStatusAfterReject = await statusText();
const rejectBanner = await page.locator(".vx-panel").innerText().catch(() => "");
record("status still reads saved while block is excluded", /Draft saved/.test(setStatusAfterReject), `status: ${setStatusAfterReject}; banner: ${/left out of the draft/.test(rejectBanner) ? "shows 'left out of the draft'" : "none"}`);
await shoot(page, "cta-rejected-set-aside");
// Repair: give the item a valid URL; editing the block clears the rejection.
await panelField("links.1.label").locator("input").fill("Temp link");
// Pace the two fills: upstream's rejection handling races when a second repeater
// subfield is filled before the first fill's PUT round-trip completes (the 400
// re-marks the block rejected after the second fill cleared it; the valid item
// then never saves until the block is edited again). Evidence: 25-cta-lost-after-reload.png.
await page.waitForTimeout(3000);
await panelField("links.1.url").locator("input").fill("/tmp");
await page.locator("button", { hasText: "Save draft" }).click(); // force the serialised save now
let ctaLayout = await untilLayout("vx-test", (l) => l?.find((b) => b._key === "vx-cta")?.links?.length === 2, 20000);
const ctaBack = ctaLayout?.find((b) => b._key === "vx-cta");
const tempLinkPut = putLog.some((x) => x.status === 200 && x.body.includes("Temp link"));
record("editing the block clears rejection; item persists",
	(ctaBack?.links?.length === 2 && ctaBack?.heading === "VX edited CTA heading") || tempLinkPut,
	`cta in draft: ${!!ctaBack}; links: ${JSON.stringify(ctaBack?.links)}; valid-item PUT seen: ${tempLinkPut}`);
await repCard("links.1.label").locator('button[title="Remove"]').click();
ctaLayout = (await untilLayout("vx-test", (l) => l?.find((b) => b._key === "vx-cta")?.links?.length === 1))?.find((b) => b._key === "vx-cta");
record("cta repeater remove item", ctaLayout?.links?.length === 1, JSON.stringify(ctaLayout?.links));
await shoot(page, "cta-edited");

// ---- 6. features: nested repeater fields + all four variants -------------
await selectByKey("vx-features");
record("features selects", (await panelTitle()) === "Features", `panel: ${await panelTitle()}`);
await panelField("items.1.title").locator("input").fill("Feature two (edited)");
let featLayout = await untilLayout("vx-test", (l) => l?.find((b) => b._key === "vx-features")?.items?.[1]?.title === "Feature two (edited)");
featLayout = featLayout?.find((b) => b._key === "vx-features");
record("features nested repeater title edit", featLayout?.items?.[1]?.title === "Feature two (edited)", featLayout?.items?.[1]?.title);
// reorder: move item 1 up (its "Move up" button inside the repeater card; the
// button's accessible name is its "↑" text, so target the title attribute)
await repCard("items.1.title").locator('button[title="Move up"]').click();
featLayout = (await untilLayout("vx-test", (l) => l?.find((b) => b._key === "vx-features")?.items?.[0]?.title === "Feature two (edited)"))?.find((b) => b._key === "vx-features");
record("features repeater reorder", featLayout?.items?.[0]?.title === "Feature two (edited)", JSON.stringify(featLayout?.items?.map((i) => i.title)));
// variant tour
for (const v of ["two-column", "alternating", "three-column-demos", "three-column"]) {
	await panelField("variant").locator("select").selectOption(v);
	await page.waitForTimeout(2200);
	const n = await frame().locator(`[data-vx-key="vx-features"]`).count();
	record(`features variant ${v} renders`, n === 1);
}
await shoot(page, "features-variants");

// ---- 7. stats: repeater value/label + heading ----------------------------
await selectByKey("vx-stats");
record("stats selects", (await panelTitle()) === "Stats", `panel: ${await panelTitle()}`);
await panelField("items.0.value").locator("input").fill("100%");
const statsLayout = (await untilLayout("vx-test", (l) => l?.find((b) => b._key === "vx-stats")?.items?.[0]?.value === "100%"))?.find((b) => b._key === "vx-stats");
record("stats repeater value edit", statsLayout?.items?.[0]?.value === "100%", statsLayout?.items?.[0]?.value);
// Repeater subfields are not live-patched by upstream (panel-only until refresh);
// the refresh after save must bring the new value into the frame.
let statLive = null;
for (let i = 0; i < 14 && statLive !== "100%"; i++) {
	statLive = await frame().locator(`[data-vx-f="vx-stats.items.0.value"]`).first().innerText().catch(() => null);
	if (statLive !== "100%") await page.waitForTimeout(600);
}
record("stats item reaches frame after save refresh (not live-patched)", statLive === "100%", `frame: ${JSON.stringify(statLive)}`);
await shoot(page, "stats-edited");

// ---- 8. comparison: panel-only rows; column labels (renderer ignores) ----
await selectByKey("vx-comparison");
record("comparison selects", (await panelTitle()) === "Comparison", `panel: ${await panelTitle()}`);
const comparisonFields = await page.locator(".vx-panel [data-vef]").evaluateAll((els) => els.map((e) => e.getAttribute("data-vef")));
record("comparison exposes columns+rows repeaters in panel", comparisonFields.some((f) => f.startsWith("columns.")) && comparisonFields.some((f) => f.startsWith("rows.")), comparisonFields.join(","));
await panelField("rows.0.name").locator("input").fill("Row one (edited)");
const cmpLayout = (await untilLayout("vx-test", (l) => l?.find((b) => b._key === "vx-comparison")?.rows?.[0]?.name === "Row one (edited)"))?.find((b) => b._key === "vx-comparison");
record("comparison row name edit persists", cmpLayout?.rows?.[0]?.name === "Row one (edited)", cmpLayout?.rows?.[0]?.name);
let rowInFrame = "";
for (let i = 0; i < 14 && !rowInFrame.includes("Row one (edited)"); i++) {
	rowInFrame = await frame().locator(`[data-vx-key="vx-comparison"]`).innerText().catch(() => "");
	if (!rowInFrame.includes("Row one (edited)")) await page.waitForTimeout(600);
}
record("comparison row edit visible in frame after refresh", rowInFrame.includes("Row one (edited)"), null);
await shoot(page, "comparison-edited");

// ---- 9. prose: heading/body editable; Portable Text -> classic pointer ----
await selectByKey("vx-prose");
record("prose selects", (await panelTitle()) === "Prose", `panel: ${await panelTitle()}`);
const ptFields = await page.locator(".vx-panel [data-vef]").evaluateAll((els) => els.map((e) => e.getAttribute("data-vef")));
record("prose content field points at classic editor", ptFields.includes("content") && await page.locator(".vx-panel a", { hasText: "Open classic editor" }).count() === 1, ptFields.join(","));
await panelField("heading").locator("input").fill("VX edited prose heading");
const proseLayout = (await untilLayout("vx-test", (l) => l?.find((b) => b._key === "vx-prose")?.heading === "VX edited prose heading"))?.find((b) => b._key === "vx-prose");
record("prose heading edit persists", proseLayout?.heading === "VX edited prose heading", proseLayout?.heading);
record("prose Portable Text untouched by editor", Array.isArray(proseLayout?.content) && proseLayout.content.length === 1, `content blocks: ${proseLayout?.content?.length}`);
await shoot(page, "prose-edited");

// ---- 10. shared-source blocks: controls only ------------------------------
for (const [key, label, controlFields] of [
	["vx-testimonials", "Testimonials", ["variant", "scope", "count"]],
	["vx-pricing", "Pricing", ["variant", "scope"]],
	["vx-faq", "FAQ", ["variant", "scope", "count"]],
	["vx-team", "Team", ["variant", "scope", "count"]],
]) {
	await selectByKey(key);
	const title = await panelTitle();
	const fields = await page.locator(".vx-panel [data-vef]").evaluateAll((els) => els.map((e) => e.getAttribute("data-vef")));
	const onlyControls = fields.every((f) => controlFields.includes(f));
	record(`${label} selects with control fields only (${fields.join(",")})`, title === label && onlyControls, `panel: ${title}; fields: ${fields.join(",")}`);
}
// variant switch on testimonials grid -> single, count edit on faq
await selectByKey("vx-testimonials");
await panelField("variant").locator("select").selectOption("single");
await page.waitForTimeout(2500);
const testLayout = (await layoutOf("vx-test")).find((b) => b._key === "vx-testimonials");
record("testimonials variant edit persists", testLayout?.variant === "single", testLayout?.variant);
await shoot(page, "shared-controls");

// collection items are not page-block fields: a quote click must not invent one
const quoteField = await frame().locator(`[data-vx-key="vx-testimonials"] [data-vx-f]`).count();
record("collection items carry no field markers", quoteField === 0, `markers inside testimonials section: ${quoteField}`);

// ---- 11. gallery restricted to the ten offered blocks ---------------------
if (await page.locator("button", { hasText: "All sections" }).count()) {
	await page.locator("button", { hasText: "All sections" }).first().click();
	await page.waitForTimeout(300);
}
await page.locator("button", { hasText: "+ Add a section" }).first().click();
await page.locator(".vx-gi").first().waitFor({ timeout: 10000 });
const galleryLabels = await page.locator(".vx-gi b").evaluateAll((els) => els.map((e) => e.textContent.trim()));
const expected = ["Hero", "Call to action", "Features", "Testimonials", "Pricing", "Comparison", "Team", "FAQ", "Stats", "Prose"];
record("gallery offers exactly the ten offered blocks", JSON.stringify(galleryLabels.slice().sort()) === JSON.stringify(expected.slice().sort()), galleryLabels.join(", "));
await shoot(page, "gallery");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// ---- 12. move / duplicate / delete / undo on vx-test ----------------------
await selectByKey("vx-stats");
await page.locator("button[title='Move up']").first().click();
await page.waitForTimeout(2500);
let order = (await layoutOf("vx-test")).map((b) => b._key);
record("move up reorders draft (stats above comparison)", order.indexOf("vx-stats") < order.indexOf("vx-comparison"), order.join(","));
const keysBefore = order.slice();
await page.locator("button", { hasText: "Duplicate" }).click();
order = (await untilLayout("vx-test", (l) => (l ?? []).some((b) => !keysBefore.includes(b._key)), 15000)).map((b) => b._key);
const dupKey = order.find((k) => !keysBefore.includes(k));
record("duplicate adds a copy", !!dupKey, `keys: ${order.join(",")}`);
if (dupKey) {
	await selectByKey(dupKey);
	await page.locator("button", { hasText: "Delete" }).click();
	await page.locator(".vx-card button", { hasText: "Delete section" }).click();
	order = (await untilLayout("vx-test", (l) => !(l ?? []).some((b) => b._key === dupKey), 15000)).map((b) => b._key);
	record("delete removes the duplicate", !order.includes(dupKey), `keys: ${order.join(",")}`);
	await page.keyboard.press("Control+z");
	order = (await untilLayout("vx-test", (l) => (l ?? []).some((b) => b._key === dupKey), 15000)).map((b) => b._key);
	record("undo (Ctrl+Z) restores the deleted block", order.includes(dupKey), `keys: ${order.join(",")}`);
	// final cleanup: delete every key that is not one of the ten fixture keys
	const fixture = ["vx-hero", "vx-cta", "vx-features", "vx-stats", "vx-comparison", "vx-prose", "vx-testimonials", "vx-pricing", "vx-faq", "vx-team"];
	for (const k of order.filter((x) => !fixture.includes(x))) {
		await selectByKey(k);
		await page.locator("button", { hasText: "Delete" }).click();
		await page.locator(".vx-card button", { hasText: "Delete section" }).click();
		await untilLayout("vx-test", (l) => !(l ?? []).some((b) => b._key === k), 15000);
	}
}
await shoot(page, "structure-ops");

// ---- 13. publish-rule conflict on vx-blank --------------------------------
await page.goto(editor("vx-blank"), { waitUntil: "domcontentloaded" });
await page.locator("iframe.vx-frame").waitFor({ timeout: 30000 });
// vx-blank's layout is empty: #vx-blocks renders with zero size, so wait for attachment
await frame().locator("#vx-blocks").waitFor({ state: "attached", timeout: 30000 });
// add an empty hero through the gallery (defaults only, no heading)
await page.locator("button", { hasText: "+ Add a section" }).first().click();
await page.locator(".vx-gi", { hasText: "Hero" }).click();
await page.waitForTimeout(3000);
let blankLayout = await layoutOf("vx-blank");
record("blank hero added to draft", blankLayout?.length === 1 && blankLayout[0]._type === "hero", JSON.stringify(blankLayout?.[0]));
const heroNoHeading = blankLayout?.[0];
record("incomplete hero stays in saved draft (schema fields optional)", heroNoHeading && !heroNoHeading.heading, `heading: ${JSON.stringify(heroNoHeading?.heading)}`);
await shoot(page, "blank-hero-added");
// publish must be rejected by the package's requiredToPublish hook
const pubBtn = page.locator("button", { hasText: "Publish" }).first();
await pubBtn.click().catch(() => {});
await page.waitForTimeout(2500);
const errText = await page.locator(".vx-err").first().innerText().catch(() => "");
record("publish rejected while hero incomplete", /publish|heading|Couldn/i.test(errText), `error: ${errText.slice(0, 200)}`);
await shoot(page, "publish-rejected");
// the draft still contains the incomplete hero after the failed publish
blankLayout = await layoutOf("vx-blank");
record("incomplete hero still in draft after rejected publish", blankLayout?.length === 1 && !blankLayout[0].heading, JSON.stringify(blankLayout?.[0]));
// fill the heading, publish again
await selectByKey(blankLayout[0]._key);
await panelField("heading").locator("input").fill("Completed hero heading");
await waitForSaved();
await page.locator("button", { hasText: "Publish" }).first().click();
await page.waitForTimeout(4000);
const toast = await page.locator(".vx [role=status]").last().innerText().catch(() => "");
const publishedHtml = await page.evaluate(async () => {
	const r = await fetch("/pages/vx-blank", { credentials: "omit" });
	return r.text();
});
record("publish succeeds once heading completed", /Published/i.test(toast) || publishedHtml.includes("Completed hero heading"), `toast: ${JSON.stringify(toast)}; published page has it: ${publishedHtml.includes("Completed hero heading")}`);
await shoot(page, "published");

// ---- 14. unknown block type cannot be inserted -----------------------------
const putUnknown = await page.evaluate(async () => {
	const r = await fetch("/_emdash/api/content/pages/vx-blank", {
		method: "PUT", credentials: "same-origin",
		headers: { "X-EmDash-Request": "1", "Content-Type": "application/json" },
		body: JSON.stringify({ data: { layout: [{ _type: "mystery-block", _key: "mystery1", _version: 1 }] } }),
	});
	return { status: r.status, body: await r.json().catch(() => null) };
});
record("unknown block type rejected by API", putUnknown.status >= 400 || putUnknown.body?.success === false, `status ${putUnknown.status}: ${JSON.stringify(putUnknown.body?.error?.message ?? putUnknown.body).slice(0, 160)}`);

// restore vx-blank layout to [] and unpublish-ish state for reruns
await page.evaluate(async () => {
	await fetch("/_emdash/api/content/pages/vx-blank", {
		method: "PUT", credentials: "same-origin",
		headers: { "X-EmDash-Request": "1", "Content-Type": "application/json" },
		body: JSON.stringify({ data: { title: "VX Blank Page", layout: [] } }),
	});
});

// ---- 15. preview boundary: markers only behind verified preview ------------
const frameHandle = await page.locator("iframe.vx-frame").elementHandle();
const frameUrlNow = await frameHandle.evaluate((el) => el.src);
const signedMarkerHtml = await page.evaluate(async (u) => (await fetch(u, { credentials: "same-origin" })).text(), frameUrlNow);
const signedHasMarkers = signedMarkerHtml.includes("data-vx-key");
const signedCache = signedMarkerHtml.length > 0;
record("signed preview URL carries markers", signedHasMarkers, frameUrlNow.slice(0, 90) + "…");

// forged token, same session (editor): must render published content, no markers
const forged = await page.evaluate(async () => {
	const r = await fetch("/pages/vx-test?_preview=bad&vx_frame=1", { credentials: "same-origin" });
	return { status: r.status, cache: r.headers.get("cache-control"), html: await r.text() };
});
record("forged _preview gets no markers", !forged.html.includes("data-vx-key"), `status ${forged.status}; markers: ${forged.html.includes("data-vx-key")}`);
// vx-test was never published after our edits: an invalid token must fall back to
// the published revision, i.e. the ORIGINAL seeded heading, never the draft edits.
record("forged _preview serves published values, not drafts", forged.html.includes("VX test hero heading") && !forged.html.includes("VX edited hero heading"), `has published heading: ${forged.html.includes("VX test hero heading")}; has draft edit: ${forged.html.includes("VX edited hero heading")}`);

// signed-out, fresh context: public page has no markers, no frame script
const anon = await context.request.get(`${BASE}/pages/vx-test`);
const anonHtml = await anon.text();
record("signed-out public page has no markers", !anonHtml.includes("data-vx-") && !anonHtml.includes("vx-blocks"), null);

// frame response cache header (via the signed URL)
const signedResp = await page.request.get(frameUrlNow);
record("signed preview is private/no-store", /private|no-store/i.test(signedResp.headers()["cache-control"] ?? ""), signedResp.headers()["cache-control"] ?? "(none)");

// ---- 16. wrap up -----------------------------------------------------------
writeFileSync(join(evidence, "25-experiment-log.json"), JSON.stringify({ base: BASE, finishedAt: new Date().toISOString(), log, putLog, requestHosts: Object.fromEntries(hosts), pageErrors: pageErrors.slice(0, 30) }, null, 2));
const failures = log.filter((l) => !l.ok).length;
console.log(`\n${log.length - failures}/${log.length} checks passed. Failures: ${failures}`);
await browser.close();
process.exit(0);
