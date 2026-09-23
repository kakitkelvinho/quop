# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone. This repo's origin fetches from GitHub (`kakitkelvinho/quop`) but push-mirrors to Aalto GitLab as well — `gh` should still resolve the GitHub repo correctly since fetch determines it.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

- **Map**: an issue labelled `wayfinder:map`. Tickets carry `wayfinder:research|prototype|grilling|task`.
- **Child tickets**: GitHub sub-issues. Attach with `gh api -X POST repos/kakitkelvinho/quop/issues/<map>/sub_issues -F sub_issue_id=<child database id>` (get the id with `gh api repos/kakitkelvinho/quop/issues/<n> --jq .id`, not the issue number). List with `gh api repos/kakitkelvinho/quop/issues/<map>/sub_issues`.
- **Blocking**: native issue dependencies. `gh api -X POST repos/kakitkelvinho/quop/issues/<blocked>/dependencies/blocked_by -F issue_id=<blocker database id>`; read with `.../dependencies/blocked_by`.
- **Claim**: `gh issue edit <n> --add-assignee @me`.
- **Frontier**: open sub-issues of the map with no assignee whose `blocked_by` list has no open issues.
