# OpenCode project guidance

`CLAUDE.md` is the detailed source of truth for this repository's architecture, domain rules, UI conventions, and verification requirements. OpenCode loads it through `opencode.json`; read and follow it before changing application code. `PLAN.md` records the frontend roadmap, and `docs/delivery-workflow-v2.md` is the authoritative workflow/API reference. `BACKEND_PHASE_3_5_HANDOFF.md` is the historical Phase 3.5 handoff, kept for context only — it predates workflow v2, so its order statuses, permission counts, and `/rider` route are out of date.

## OpenCode workflow notes

- Use the installed OpenCode tools and skills. The skill names in `CLAUDE.md` may refer to Claude-only skills; invoke a skill only if it is available in the current OpenCode session. If a required skill is unavailable, say so and continue using the design and accessibility rules in `CLAUDE.md`.
- Keep using `pnpm`; do not add dependencies or new test files without an explicit user request.
- For office dashboard and report changes, follow `CLAUDE.md`, `PLAN.md`, `../delivery_solution_api/PLAN.md`, and `docs/delivery-workflow-v2.md`; preserve office/RIDER/shop data boundaries and the stated metric limitations (COD projections are not cash-received records).
- For dashboard metric summaries, charts, graphs, or other data visualizations, invoke the `data-visualization` skill before implementing the visualization; verify the metric semantics against the API and plan.
- Preserve pre-existing working-tree changes. Commit or push only when the user explicitly requests it, and stage only the intended project files.
- Use `/verify` to run this repository's automated checks before reporting code changes complete. State clearly when a backend smoke test could not be performed.

## Skills & tools for this repo

- **UI work:** layer the skills — `ui-ux-pro-max` (structure/usability) → `frontend-design` (aesthetic direction) → `design-taste-frontend` (polish). This is a dense ops dashboard, so prefer usability over landing-page aesthetics.
- **Layout/height/scroll/position changes:** verify in a real browser with the `playwright` MCP tools, not just `pnpm build` — jsdom has no layout engine, so `max-h`/`overflow`/`min-h-0` "pass" there while the page is broken.
- **Components:** the `shadcn` MCP tools can look up registry components; the project already vendors its own under `src/components/ui/`.
- **`n8n` MCP is unrelated to this repo** — do not reach for it here.
- Commands: `/verify` (checks), `/code-review` (PR review via `gh`), `/feature-dev` (guided feature workflow). Subagents: `@code-explorer`, `@code-architect`, `@code-reviewer`.
