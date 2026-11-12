import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";

for (const scenario of [
  { name: "moderation smoke reads each result and deletes its comments", statuses: ["approved", "spam", "pending"], exit: 0 },
  { name: "moderation mismatch fails but still deletes all comments", statuses: ["pending", "spam", "pending"], exit: 1 },
]) test(scenario.name, async () => {
  const comments = new Map();
  const statuses = scenario.statuses;
  let next = 0;
  const server = createServer(async (req, res) => {
    let data = "";
    for await (const chunk of req) data += chunk;
    res.setHeader("content-type", "application/json");
    const send = (payload, code = 200) => { res.statusCode = code; res.end(JSON.stringify(payload)); };
    if (req.url === "/_emdash/api/content/posts?status=published&limit=1") {
      return send({ success: true, data: { items: [{ id: "post-id" }] } });
    }
    if (req.url === "/_emdash/api/admin/comments/counts" && req.headers.authorization === "Bearer test-token") {
      return send({ success: true, data: {} });
    }
    if (req.url === "/_emdash/api/auth/me" && req.headers.authorization === "Bearer test-token") {
      return send({ success: true, data: { role: 50 } });
    }
    if (req.url === "/_emdash/api/comments/posts/post-id" && req.method === "POST") {
      const id = String(++next);
      comments.set(id, statuses[next - 1]);
      return send({ success: true, data: { id, status: statuses[next - 1] } }, 201);
    }
    const match = req.url.match(/^\/_emdash\/api\/admin\/comments\/(\d+)$/);
    if (match && req.headers.authorization === "Bearer test-token") {
      if (req.method === "GET") return send({ success: true, data: { id: match[1], status: comments.get(match[1]) } });
      if (req.method === "DELETE") { comments.delete(match[1]); return send({ success: true, data: { deleted: true } }); }
    }
    send({ success: false }, 404);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/check-comment-moderation.mjs", `http://127.0.0.1:${server.address().port}`], {
      env: { ...process.env, EMDASH_COMMENT_SMOKE_TOKEN: "test-token" },
    });

    let output = "";
    child.stdout.on("data", chunk => output += chunk);
    child.stderr.on("data", chunk => output += chunk);
    const [code] = await once(child, "close");
    assert.equal(code, scenario.exit, output);
    if (scenario.exit === 0) assert.match(output, /approved/);
    else assert.match(output, /expected approved, got pending/);
    assert.match(output, /spam/);
    assert.match(output, /pending/);
    assert.equal(next, 3);
    assert.equal(comments.size, 0);
  } finally {
    server.close();
  }
});

test("invalid admin token cannot create public comments", async () => {
  let submissions = 0;
  const server = createServer((req, res) => {
    if (req.method === "POST") submissions++;
    res.setHeader("content-type", "application/json");
    if (req.url.startsWith("/_emdash/api/content/posts")) {
      res.end(JSON.stringify({ success: true, data: { items: [{ id: "post-id" }] } }));
    } else {
      res.statusCode = 403;
      res.end(JSON.stringify({ success: false }));
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/check-comment-moderation.mjs", `http://127.0.0.1:${server.address().port}`], {
      env: { ...process.env, EMDASH_COMMENT_SMOKE_TOKEN: "invalid-token" },
      stdio: "ignore",
    });
    const [code] = await once(child, "close");
    assert.equal(code, 1);
    assert.equal(submissions, 0);
  } finally {
    server.close();
  }
});

test("a token without comment deletion permission cannot create public comments", async () => {
  let submissions = 0;
  const server = createServer((req, res) => {
    if (req.method === "POST") submissions++;
    res.setHeader("content-type", "application/json");
    const data = req.url.startsWith("/_emdash/api/content/posts") ? { items: [{ id: "post-id" }] }
      : req.url === "/_emdash/api/auth/me" ? { role: 40 } : {};
    res.end(JSON.stringify({ success: true, data }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/check-comment-moderation.mjs", `http://127.0.0.1:${server.address().port}`], {
      env: { ...process.env, EMDASH_COMMENT_SMOKE_TOKEN: "editor-token" },
      stdio: "ignore",
    });
    const [code] = await once(child, "close");
    assert.equal(code, 1);
    assert.equal(submissions, 0);
  } finally {
    server.close();
  }
});
