# 37-f8eac14e: Make changes to this repo's review and merge policy high tier

**Spec:** none; James, 2026-11-16, alongside agent-workflow's ticket 71, which lets the orchestrator merge medium there and keeps self-policy changes high.

**What to build:**

`docs/agents/review.md` lets the orchestrator merge medium-tier PRs, which reach only staging (James, 2026-11-12). Its medium row lists `docs/agents/` among the medium paths, and that folder holds `review.md` and `merging.md` themselves. So an unattended run could merge a change that relaxes this repo's own review or merge rules, with only the orchestrator's review behind it.

In `docs/agents/review.md`, add changes to how this repo reviews, merges or sets tiers to the high row: `docs/agents/review.md`, `docs/agents/merging.md`, and anything else that sets required reviews, checks or approvers. Say why (the factory can't loosen its own gates unattended) and attribute it to James, 2026-11-16. Narrow the medium row's `docs/agents/` so it no longer covers those files. Everything else in `docs/agents/` stays medium, and the staging-autonomous medium policy is otherwise unchanged.

This changes merge policy, so it is high under its own rule: James approves it.

**Blocked by:** none.

**Status:** in progress

- [ ] `docs/agents/review.md`'s high row covers changes to `docs/agents/review.md`, `docs/agents/merging.md` and anything else that sets review, check or approver requirements, with the reason and James's attribution, and the medium row no longer includes them.
- [ ] Nothing else in the medium or high policy changes (removed lines checked by the orchestrator).
- [ ] The repo's checks pass, as `docs/agents/merging.md` and `AGENTS.md` define them.

## Comments

**2026-11-16 Orchestrator:** Risk: high (changes `docs/agents/review.md` self-policy governing how this repo sets tiers, reviews and merges; self-policy changes require James's approval).
