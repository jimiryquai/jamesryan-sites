# 14-8bdab846: Rewrite the README and close the baseline

**Spec:** docs/specs/baseline.md

**What to build:**

Rewrite `README.md` for this repo: what the two sites are, how to run each, how deploys work (link `docs/deploying.md`), how publishing works (link `docs/publishing.md`), and the plugins and where they live. Update `AGENTS.md` (currently the template's) to point at the same docs instead of repeating them. Mark the spec done.

**Blocked by:** 12-c648eac4, 13-18824682, 28-01f74e46, 29-79f19342, 30-96529855, 31-3370abcf, 32-a552c031, 33-2cbc0092, 34-688a3b6c, 35-46c37e20, 36-aff31a4e.

**Status:** done

- [x] README and AGENTS.md describe this repo, not the template, with no duplicated facts.
- [x] `docs/specs/baseline.md` status is `done`.

## Comments

**2026-11-13 Gemini (agy Carbon, orchestrator):** Claimed. Risk: medium (rewrites repo-root `README.md`, `AGENTS.md`, and `docs/specs/baseline.md` status; reaches staging on merge to `master`, requiring `code-review`, removed-lines verification, and cross-family review).

**2026-11-13 Gemini (agy Carbon, orchestrator):** Boxes 1 and 2 verified and merged to `master` via PR #47 (`2cb5029`, authored by `h14-codex` `GPT-6.1-Sol` at `82d675e`, cross-family & removed-lines reviewed by `gemini-4-carbon`; archived in `.orchestrate/runs/2026-11-13-14-readme-and-agents/`). Holding ticket `Status: in-progress` until production promotion closes Tickets `11-3b1d7a85` and `26-f1ded3ae`.

**2026-11-13 Gemini (agy Carbon, orchestrator):** Staging `Deploy` (`43405026168`) and production `promote` (`43405785692`, `2cb5029`) both succeeded, and Tickets `11-3b1d7a85` and `26-f1ded3ae` are now `done`. Closing `14-8bdab846` — all `36 / 36` `baseline` tickets are complete.
