const token = process.env.EMDASH_COMMENT_SMOKE_TOKEN;
if (process.argv.length !== 3 || !token) {
  console.error("Usage: EMDASH_COMMENT_SMOKE_TOKEN=<admin token> node scripts/check-comment-moderation.mjs <origin>");
  process.exit(1);
}

const origin = new URL(process.argv[2]).origin;
const auth = { Authorization: `Bearer ${token}` };
const cases = [
  { name: "clean", body: "Thank you for sharing this useful article.", status: "approved" },
  { name: "spam", body: "Buy cheap miracle pills now at https://spam.example and make money fast!", status: "spam" },
  { name: "toxic", body: "You are an idiot and nobody wants to hear your stupid opinions.", status: "pending" },
];

async function request(path, options = {}) {
  const response = await fetch(new URL(path, origin), {
    redirect: "error", signal: AbortSignal.timeout(30000), ...options,
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch {
    console.log(`${options.method ?? "GET"} ${path}: ${response.status} ${path === "/_emdash/api/auth/me" ? "[redacted]" : text}`);
    throw new Error(`Non-JSON response from ${path}`);
  }
  const logged = path === "/_emdash/api/auth/me" && result.data
    ? { ...result, data: { role: result.data.role } }
    : result;
  console.log(`${options.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(logged)}`);
  if (!response.ok || result.success !== true) throw new Error(`Request failed: ${path}`);
  return result.data;
}

try {
  const posts = await request("/_emdash/api/content/posts?status=published&limit=1", { headers: auth });
  const postId = posts.items?.[0]?.id;
  if (!postId) throw new Error("No published post available for comment moderation check");
  await request("/_emdash/api/admin/comments/counts", { headers: auth });
  const user = await request("/_emdash/api/auth/me", { headers: auth });
  if (user.role !== 50) throw new Error("The smoke token must belong to an administrator who can delete comments");

  let failed = false;
  for (const item of cases) {
    let id;
    try {
      const created = await request(`/_emdash/api/comments/posts/${encodeURIComponent(postId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" },
        body: JSON.stringify({ authorName: "Moderation smoke test", authorEmail: "moderation-smoke@example.invalid", body: item.body }),
      });
      id = created.id;
      if (!id) throw new Error("Submission returned no comment ID; inspect moderation inbox for the smoke test");
      const comment = await request(`/_emdash/api/admin/comments/${encodeURIComponent(id)}`, { headers: auth });
      if (comment.status !== item.status) throw new Error(`${item.name}: expected ${item.status}, got ${comment.status}`);
      console.log(`${item.name}: ${comment.status}`);
    } catch (error) {
      failed = true;
      console.error(error.message);
    } finally {
      if (id) {
        try {
          await request(`/_emdash/api/admin/comments/${encodeURIComponent(id)}`, { method: "DELETE", headers: auth });
        } catch (error) {
          failed = true;
          console.error(`Cleanup failed for comment ${id}: ${error.message}`);
        }
      }
    }
  }
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
