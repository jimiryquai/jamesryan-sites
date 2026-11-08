# 13-18824682: Review the upgraded codebase against the design principles

**Spec:** docs/specs/baseline.md

**What to build:**

Review this repo, `../emdash-plugin-code-block-pro` and `../emdash-plugin-ai-comment-moderation` against `~/Repos/Workspace/building/agent-workflow/docs/design-principles.md` (deep modules, one source of truth, config versus derived defaults, agent-native interfaces), plus correctness, security (auth, tokens, sandbox capabilities) and dead code. Pay particular attention to: duplication between the two apps (`marketing-blocks` is identical in both, and the astro configs mostly duplicate each other), what belongs in `packages/cms-helpers` and `packages/ui`, and leftover garden pages (`home-01..03` etc.). Each finding becomes a ticket in this effort or the backlog; this ticket makes no code changes.

**Blocked by:** 05-10cd2eae, 06-7a434f76, 09-b9733862, 10-eaea4d2b, 11-3b1d7a85, 17-caadd917.

**Status:** ready-for-agent

- [ ] A findings report lives in a comment on this ticket, each finding linked to a new ticket or a backlog line.
- [ ] James has triaged the findings (status `needs James` until then).

## Comments
