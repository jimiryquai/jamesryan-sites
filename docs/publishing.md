# Drafting posts

**Staging is blocked:** on 2026-11-09 the staging agent token successfully
published a test post despite its intended Contributor role. Its publish and
delete restrictions have not been proven. Do not use this token for authoring
until an administrator has corrected and independently verified its access.
The procedure below records the staging draft creation, not a proven safe
publishing boundary.

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

## Create a draft once access is fixed

From the repository root, use Node 24 and pnpm. The gitignored `.env` must
contain `EMDASH_AGENT_STAGING_TOKEN`; never print or commit it. The following
loads it into the process environment without putting it in the command line:

```sh
node --env-file=.env "$(command -v pnpm)" exec mcporter list emdash-staging-agent --schema
```

Upload an image and record its returned `item.id`, `item.url`, `width` and
`height`. Replace the filename, MIME type and alt text. The inline form below
was used for the small test image:

```sh
node --env-file=.env "$(command -v pnpm)" exec mcporter call \
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
node --env-file=.env "$(command -v pnpm)" exec mcporter call \
  emdash-staging-agent.content_create --args "$(cat draft.json)"
node --env-file=.env "$(command -v pnpm)" exec mcporter call \
  emdash-staging-agent.content_get collection:posts id:POST_ID
```

Check `status`, content, image alt, SEO fields and `_rev` in the response.
To revise a draft, obtain a fresh `_rev` with `content_get` and pass it to
`content_update` with the fields to change; inspect
`mcporter list emdash-staging-agent --schema` for its arguments. Tell James the
post ID and slug so he can review it in the admin. After James publishes it,
check the rendered post, metadata, comments and staging validators.

EmDash documents role and token-scope enforcement in its
[AI tools guide](https://docs.emdashcms.com/guides/ai-tools/) and
[MCP reference](https://docs.emdashcms.com/reference/mcp-server/); the observed
staging publish result contradicts the intended boundary and takes precedence
until investigated.
