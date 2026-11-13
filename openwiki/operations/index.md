# Files

- [Database migration management](database-migrations.md) - How D1 schema changes reach Cloudflare — migrate-deployment.sh's status/apply/check/recover operations, reviewed target fingerprints, and the lock-takeover recovery procedure.
- [Deployment pipeline](deployment-pipeline.md) - The CI gates and Deploy workflow — staging deploys per app on master merge, manual production promotion bound to a staged commit, migration recovery dispatches, and the one-time secrets wizard.
- [Publishing workflow and MCP access](publishing-workflow.md) - The agent-drafts, human-publishes split for posts, the staging token-owner preflight that gates every write, and the mcporter config layout for docs, staging, local, and Cloudflare MCP servers.
- [Verification and quality checks](verification-suite.md) - The layered check suite — root node --test scripts, per-package tests, isolated rendered-SEO workers over real seed data, staging smokes, Playwright/axe accessibility scans, and theme keyboard recordings.
