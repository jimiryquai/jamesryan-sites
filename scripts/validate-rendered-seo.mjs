import {
  countH1s, findImagesWithoutAlt, extractTitle, extractMetaDescription, extractAnchorHrefs,
  DEFAULT_METADATA_LENGTH_BOUNDS,
} from "@jdevalk/astro-seo-graph/integration";

async function checkLink(url) {
  let current = url;
  let slashMismatch = false;
  for (let redirects = 0; redirects < 10; redirects++) {
    const response = await fetch(current, { redirect: "manual" });
    if (response.status < 300 || response.status >= 400) {
      return { status: response.status, slashMismatch };
    }
    const location = response.headers.get("location");
    if (!location) return { status: response.status, slashMismatch, invalid: true };
    const next = new URL(location, current);
    if (next.origin !== url.origin) return { status: response.status, slashMismatch };
    if (next.pathname !== current.pathname &&
      next.pathname.replace(/\/$/, "") === current.pathname.replace(/\/$/, "")) {
      slashMismatch = true;
    }
    current = next;
  }
  return { status: 0, slashMismatch, invalid: true };
}

async function main(origin) {
  const sitemap = await fetch(new URL("/sitemap.xml", origin));
  if (!sitemap.ok) throw new Error(`sitemap: HTTP ${sitemap.status}`);
  const xml = await sitemap.text();
  const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/gs)].map(match => new URL(match[1]));
  if (!locations.length) throw new Error("sitemap has no pages");
  let errors = 0;
  const seen = { title: new Map(), description: new Map() };
  const linkResults = new Map();
  for (const location of locations) {
    const url = new URL(location.pathname + location.search, origin);
    const response = await fetch(url, { redirect: "manual" });
    if (!response.ok) {
      console.error(`${url.pathname}: HTTP ${response.status}`);
      errors++;
      continue;
    }
    console.log(`Checking ${url.pathname}`);
    const html = await response.text();
    const count = countH1s(html);
    if (count !== 1) {
      console.error(`${url.pathname}: H1 validation: expected 1, found ${count}`);
      errors++;
    }
    const images = findImagesWithoutAlt(html);
    if (images.length) {
      console.error(`${url.pathname}: image alt validation: ${images.join(", ")}`);
      errors++;
    }
    for (const [field, value] of Object.entries({
      title: extractTitle(html),
      description: extractMetaDescription(html),
    })) {
      if (!value) continue;
      const { min, max } = DEFAULT_METADATA_LENGTH_BOUNDS[field];
      if (value.length < min || value.length > max) {
        console.error(`${url.pathname}: metadata length: ${field} has ${value.length} characters (expected ${min}-${max})`);
        errors++;
      }
      if (seen[field].has(value)) {
        console.error(`${url.pathname}: metadata uniqueness: ${field} also occurs at ${seen[field].get(value)}`);
        errors++;
      } else {
        seen[field].set(value, url.pathname);
      }
    }
    for (const href of extractAnchorHrefs(html)) {
      if (!href.startsWith("/") && !href.startsWith(location.origin + "/")) continue;
      const target = new URL(href.replaceAll("&amp;", "&"), location);
      if (target.origin !== location.origin) continue;
      const local = new URL(target.pathname + target.search, origin);
      if (!linkResults.has(local.href)) {
        linkResults.set(local.href, await checkLink(local));
      }
      const result = linkResults.get(local.href);
      if (result.status >= 400 || result.slashMismatch || result.invalid) {
        console.error(`${url.pathname}: internal link ${href}: HTTP ${result.status}${result.slashMismatch ? " (trailing slash redirect)" : ""}`);
        errors++;
      }
    }
  }
  console.log(`${locations.length} pages checked at ${origin}`);
  return errors;
}

try {
  if (!process.argv[2]) throw new Error("usage: node scripts/validate-rendered-seo.mjs <origin>");
  if (await main(process.argv[2])) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
