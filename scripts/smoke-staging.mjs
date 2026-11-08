const hosts = process.argv.slice(2);
if (!hosts.length) {
  console.error("Usage: node scripts/smoke-staging.mjs <staging-origin> [...]");
  process.exit(1);
}

let failed = false;
for (const host of hosts) {
  const origin = new URL(host).origin;
  async function check(path) {
    const url = new URL(path, origin);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      console.log(`${response.status} ${url}`);
      if (response.status !== 200 || new URL(response.url).origin !== origin) failed = true;
      return response;
    } catch (error) {
      console.error(`ERROR ${url}: ${error.message}`);
      failed = true;
      return null;
    }
  }
  for (const path of ["/", "/_emdash/admin", "/robots.txt", "/llms.txt"]) await check(path);
  const sitemap = await check("/sitemap.xml");
  const xml = sitemap?.status === 200 ? await sitemap.text() : "";
  const locations = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)];
  const post = locations.map(([, loc]) => {
    try { return new URL(loc.trim()); } catch { return null; }
  }).find(url => url?.pathname.startsWith("/posts/") && url.pathname !== "/posts/");
  if (post) await check(post.pathname + post.search);
  else {
    console.error(`ERROR ${origin}: sitemap has no post URL`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
