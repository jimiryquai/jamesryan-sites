# Drafting posts

James reviews and publishes posts in the EmDash admin. Agents prepare drafts;
they do not publish or delete them. The staging admin is at
`https://staging.jamesryan.dev/_emdash/admin`. Do not use staging credentials
or this staging server for production.

## Fields

- `title`: required post heading; use one clear H1. Use H2 or lower in the body.
- `excerpt`: a concise summary for the post; the schema does not set a length
  limit or require it, but include one for readers.
- `seo.title`: title text without the site's ` — James Ryan` suffix. The
  rendered title including that suffix must be 30–65 characters.
- `seo.description`: unique description of 70–200 characters.
- Images: include meaningful `alt` text describing each image in context.

The site schema is in `apps/marketing-site/seed/seed.json`; live deployments
may differ. The agent token lacks `schema:read`, so check with an administrator
if the deployed collection differs.

## Preflight: verify the token owner

Before any write, check the exact token in staging D1. A token created while
signed in as an admin belongs to that admin and carries admin permissions,
even if its name says otherwise. The earlier test used such a token and
published unexpectedly. Staging's `/_emdash/api/auth/me` returned 403 for
the Contributor token, so use this read-only D1 check instead.

From the repository root, use Node 24, pnpm and Cloudflare credentials with
read access to the staging D1 database. The gitignored `.env` must contain
`EMDASH_AGENT_STAGING_TOKEN`; never print or commit it. The check hashes the
token locally and queries only its matching record, without printing the
token, hash or SQL. Run it before uploading media or creating a draft:

```sh
export WRANGLER_SEND_METRICS=false ASTRO_TELEMETRY_DISABLED=1
node --env-file=.env --input-type=module <<'NODE'
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const token = process.env.EMDASH_AGENT_STAGING_TOKEN;
if (!token) throw new Error("Missing staging token");
const hash = createHash("sha256").update(token).digest("base64url");
const sql = `SELECT u.email, u.role, t.scopes, t.expires_at
  FROM _emdash_api_tokens t JOIN users u ON u.id = t.user_id
  WHERE t.token_hash = '${hash}'`;
const result = spawnSync("pnpm", [
  "--dir", "apps/marketing-site", "exec", "wrangler", "d1", "execute",
  "DB", "--env", "staging", "--remote", "--json", "--command", sql
], { encoding: "utf8", env: process.env });
if (result.status !== 0) {
  console.error((result.stderr || result.stdout || "D1 query failed")
    .replaceAll(token, "[REDACTED]").replaceAll(hash, "[REDACTED]"));
  process.exit(1);
}
const rows = JSON.parse(result.stdout).flatMap(entry => entry.results ?? []);
const row = rows[0];
const scopes = row && JSON.parse(row.scopes);
const required = ["content:read", "content:write", "media:read", "media:write"];
const valid = rows.length === 1 && row.email === "agent@jamesryan.dev"
  && Number(row.role) === 20 && required.every(scope => scopes.includes(scope))
  && (!row.expires_at || Date.parse(row.expires_at) > Date.now());
console.log(JSON.stringify({ matched: rows.length, email: row?.email,
  role: row?.role, scopes, expiresAt: row?.expires_at,
  preflight: valid ? "PASS" : "FAIL" }));
if (!valid) process.exitCode = 1;
NODE
```

Proceed only on `PASS`: one matching token, owned by the Agent Contributor
(role 20), with all four scopes and not expired. If this check fails or D1
access is unavailable, stop and ask an administrator to verify and fix the
token; do not infer its role from its name or scopes.

## Create a draft

`pnpm -s mcp:staging` loads `EMDASH_AGENT_STAGING_TOKEN` from `.env` and targets
`config/mcporter.staging.json` (see [`docs/mcp.md`](mcp.md) for MCP config
layout):

```sh
pnpm -s mcp:staging list emdash-staging-agent --schema
```

Upload an image and record its returned `item.id`, `item.url`, `width` and
`height`. Replace the filename, MIME type and alt text. The inline form below
was used for the small test image:

```sh
pnpm -s mcp:staging call \
  emdash-staging-agent.media_upload \
  filename:example.png "base64:$(base64 -w 0 example.png)" \
  contentType:image/png 'alt:Describe the image in context'
```

For larger files, write the base64 to a temporary file and pass
`base64=@/path/to/file` instead, avoiding the shell's argument-size limit;
remove that temporary file after upload.

Create `draft.json` with the following shape, substituting your own copy,
unique slug, and the uploaded image's returned ID, URL and dimensions. The
`code-block-pro` object is a Code Block Pro block, not a Markdown code fence.
The example text is fixture text, not James's copy.

```json
{
  "collection": "posts",
  "slug": "example-draft",
  "data": {
    "title": "Example draft heading",
    "excerpt": "A concise summary of the post.",
    "content": [
      {
        "_type": "block",
        "_key": "heading",
        "style": "h2",
        "children": [{ "_type": "span", "_key": "heading-text", "text": "Example section" }]
      },
      {
        "_type": "code-block-pro",
        "_key": "code",
        "code": "console.log('Example');",
        "language": "javascript",
        "theme": "github-dark",
        "lineNumbers": true,
        "copyButton": true
      },
      {
        "_type": "image",
        "_key": "image",
        "asset": { "_type": "reference", "_ref": "MEDIA_ID", "url": "MEDIA_URL" },
        "alt": "Describe the image in context",
        "width": 1,
        "height": 1
      }
    ]
  },
  "seo": {
    "title": "Example draft publishing path",
    "description": "Replace this fixture description with a unique summary of the post for search results."
  }
}
```

Create without setting a published status, then read the result using its ID:

```sh
pnpm -s mcp:staging call \
  emdash-staging-agent.content_create --args "$(cat draft.json)"
pnpm -s mcp:staging call \
  emdash-staging-agent.content_get collection:posts id:POST_ID
```

Check `status`, content, image alt, SEO fields and `_rev` in the response.
To revise a draft, obtain a fresh `_rev` with `content_get` and pass it to
`content_update` with the fields to change; inspect
`pnpm -s mcp:staging list emdash-staging-agent --schema`
for its arguments. Tell James the post ID and slug so he can review it in the
admin. After James publishes it, check the rendered post, metadata, comments
and staging validators.

EmDash documents role and token-scope enforcement in its
[AI tools guide](https://docs.emdashcms.com/guides/ai-tools/) and
[MCP reference](https://docs.emdashcms.com/reference/mcp-server/).
