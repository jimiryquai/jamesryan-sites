const args = process.argv.slice(2);
if (!args.length || args.at(-1) === "--posts=optional") {
  console.error("Usage: node scripts/smoke-staging.mjs [--posts=optional] <staging-origin> [...]");
  process.exit(1);
}

let failed = false;
let postsOptional = false;
for (const host of args) {
  if (host === "--posts=optional") {
    postsOptional = true;
    continue;
  }
  const origin = new URL(host).origin;
  async function check(path) {
    const url = new URL(path, origin);
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      console.log(`${response.status} ${url}`);
      if (response.status !== 200 || new URL(response.url).origin !== origin) failed = true;
      return response;
    } catch (error) {
      console.error(`ERROR ${url}: ${error.message}`);
      failed = true;
      return null;
    }
  }
  for (const path of ["/", "/_emdash/admin/login", "/robots.txt", "/llms.txt"]) await check(path);
  const sitemap = await check("/sitemap.xml");
  const xml = sitemap?.status === 200 ? await sitemap.text() : "";
  const locations = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)];
  const post = locations.map(([, loc]) => {
    try { return new URL(loc.trim()); } catch { return null; }
  }).find(url => url?.pathname.startsWith("/posts/") && url.pathname !== "/posts/");
  if (post) await check(post.pathname + post.search);
  else if (sitemap?.status === 200 && postsOptional) {
    console.log(`${origin}: no posts yet`);
  } else if (sitemap?.status === 200) {
    console.error(`ERROR ${origin}: sitemap has no post URL`);
    failed = true;
  }
  postsOptional = false;
}
if (failed) process.exitCode = 1;
