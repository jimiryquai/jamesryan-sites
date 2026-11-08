# Baseline: a codebase we can trust

**Status:** agreed 2026-11-08 (grilling session). Tickets: `.scratch/baseline/issues/`.

## Why

The repo hasn't been touched since July 2026. Before the content flywheel starts publishing to jamesryan.dev, both sites need to be on current EmDash, deployed through a pipeline that tests them, accessible, and free of template leftovers and duplicated code. The baseline is done when every change reaches production only through that pipeline, and the flywheel's publishing path has been proven end to end.

## Scope

| Site | Treatment |
|---|---|
| **jamesryan.dev** (`apps/marketing-site`) | Full baseline. The flywheel publishes here. |
| **jamesryan.me** (`apps/digital-garden`) | Upgraded, builds, tested, own D1/R2/KV for staging and production, domain configured. **Staging only**: nothing goes live at jamesryan.me. Its content model is a later project. |

## Decisions

1. **EmDash 0.14 → 1.4** for both apps, along with the SEO packages (`@jdevalk/emdash-plugin-seo` 0.12, `astro-seo-graph` 2.2, `seo-graph-core` 0.7). The `emdash@0.14.0` patch (WebP via `getImage` in `EmDashImage.astro`) is dropped if 1.4 covers it natively; otherwise it's re-applied, with the reason recorded. The empty `@emdash-cms/admin` patch goes.
2. **Code Block Pro stays native.** EmDash only allows native plugins to provide Portable Text rendering components, so sandboxed ("external") was never possible; that's why the earlier attempt failed. The copy in `packages/emdash-plugin-code-block-pro` is ahead of `../emdash-plugin-code-block-pro` (it has Plain Text and Mermaid). Merge it back, upgrade to 1.4, publish to npm through the repo's existing trusted-publisher CI, then delete the copy and depend on the npm package. One source of truth.
3. **AI Comment Moderation is installed sandboxed** on jamesryan.dev, under `sandboxed: []`, from npm (`emdash-plugin-ai-comment-moderation`, currently 1.0.0, built for emdash ^0.9). Its tests today all run against a mocked `ctx`. Add real tests (with `@emdash-cms/plugin-test` if it runs plugins in a real sandbox runner) plus a staging end-to-end check: a clean comment is approved, a spam comment is flagged as spam, a toxic comment is held as pending.
4. **Deploys go through GitHub Actions** for both sites. PRs run install, typecheck, build and tests. A merge to `master` deploys to staging and runs checks against it. Production is a manual `workflow_dispatch` that promotes what's on staging. Staging gets its own KV namespace (today it shares production's).
5. **One olive palette.** The olive scale in `tailwind.css` is the brand. The template's indigo and pink tokens in `theme.css` and `globals.css` are deleted. Target WCAG 2.2 AA in light and dark modes, enforced by axe and a contrast check in the staging pipeline. A failing olive shade gets a lightness change with the hue unchanged, shown to James before and after.
6. **SEO** means the packages: upgrade, drop the `entrypoint`/`adminEntry` workaround in `astro.config.mjs` if it's no longer needed, and generate `llms.txt` from real pages and posts, not a hand-written list (it currently lists the template's `/pricing`). The `astro-seo-graph` validators run in the pipeline. No SEO skill.
7. **Publishing path:** an agent creates a **draft** through EmDash's MCP with a scoped token. James reviews it and publishes in the admin; agents never publish. Proved on staging and production, with code blocks, Mermaid, images, SEO fields and comments all checked, and documented in the repo so people and agents follow the same steps. It is carried into the blueprint later.
8. **Both plugins are public on npm.** James approves each first `npm publish`.
9. **The codebase review runs after the upgrade**, across this repo and both plugin repos, against `~/Repos/Workspace/building/agent-workflow/docs/design-principles.md`. Its findings become tickets.
10. **Housekeeping:** remove the Lighthouse reports, `debug_save.sh`, the root `package-lock.json` (pnpm is the package manager), the copy's `sandbox.db` and lockfiles, and the Z.ai MCP wrapper skills and the pi `agent-browser` symlink (machine tooling, not project knowledge). Refresh EmDash's own skills from 1.4. Rewrite the README for this repo, not the template.

## Out of scope (next projects, in order)

1. **jamesryan.dev blueprint.** A reusable site from .dev, including the page builder (`marketing-blocks`, which reads from collections rather than hard-coded text): compare it with upstream's v1.3.0 marketing template and expand it with Tailwind Plus layouts. It gets its own grilling.
2. **Garden content model** for jamesryan.me.

## Human-only steps

- Cloudflare API token and account ID as GitHub Actions secrets; creating the new D1, R2 and KV resources if an agent's token can't.
- Approving each first `npm publish`, and every production promotion.
- Reviewing the palette before and after.
