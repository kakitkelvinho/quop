## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on kakitkelvinho/quop, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Comments

Write a comment only to say why: a decision, the physics behind a number, a setup-file compatibility constraint, or a link to an ADR. Do not write comments that repeat what the code says.

- When a comment says a field is for some kinds only, or must match something elsewhere, enforce it with a type or a test instead.
- Put units in names (`delayTravelMm`), not in comments.
- When you change code, fix or delete any comment it makes wrong.
- Do not mass-delete existing comments. Tidy them in the files you touch.

### Workflow

Every change goes on a branch and through a PR with the `ci` check green, updated to main before merging. No pushes to main. Tests run with `npm test` (`node --test`); pure modules are tested in Node, with fast-check for laws.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
