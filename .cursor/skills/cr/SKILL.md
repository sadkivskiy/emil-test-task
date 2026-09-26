---
name: cr
description: >-
  Reviews this repository against docs/Code Style & Architecture Guidelines.md.
  Use when the user says CR, code review, or review the diff.
  Default scope is uncommitted changes. CR --all or CR project reviews the
  whole tree.
disable-model-invocation: true
---

# CR

Review code against `docs/Code Style & Architecture Guidelines.md`. That file is the standard. Read it at the start of every review. Do not keep a second copy of the rules here.

Do not edit files, commit, or refactor unless the user asks for that after the review.

Write the review in English.

## Scope

| Invocation | Scope |
| --- | --- |
| `CR` | Uncommitted changes only |
| `CR --all` | Whole project |

Treat these as `CR --all`: `--all`, `project`, `whole`. Anything else is `CR`.

### Uncommitted

Run from the repo root:

```bash
git status --short
git diff --stat && git diff
git diff --cached --stat && git diff --cached
```

Include untracked source files. Ignore `.env`, `.idea/`, `node_modules/`, `reports/`, `FINDINGS.md`, and lockfiles unless the change is the dependency declaration itself.

Judge the changed lines and any rule the change breaks. Mention a pre-existing violation only when the change touches that code.

If there is nothing to review, say so and stop.

### Whole project

Review `src/`, `tests/`, `cucumber.js`, `tsconfig.json`, `package.json`, and `.env.example`. Skip `node_modules/`, `reports/`, `.idea/`, `.env`, and `FINDINGS.md`.

The tree is in scope, including places it disagrees with the guidelines. A missing target (compiler flags, ESLint, env schema) is a finding.

## How to review

1. Read the guidelines.
2. Collect the scope above.
3. Check each in-scope module against sections 2–3 (layout and boundaries), 4–6 (TypeScript and style), 7–9 (Zod, config, polling), 10 (Cucumber), and the Review checklist.
4. For a diff that touches features or steps, confirm each new Gherkin step has a definition. Run `npx cucumber-js --dry-run` only when steps or features changed.
5. Run `npx tsc --noEmit` only when TypeScript files changed, or always for `CR --all`.

A live API failure and a defect listed in `FINDINGS.md` are product findings. They are not code-review findings when the test still asserts the documented contract.

## Report

Lead with the scope and a one-line verdict: approve, or reject with the count of must-fix items.

```markdown
## Must fix
- `path:line` — rule (guidelines section). What is wrong. What to change.

## Gaps
- `path:line` — tree disagrees with the guidelines, outside the Review checklist.

## Notes
- Optional. Omit this section when empty.
```

`Must fix` is the Review checklist and any broken boundary (second Axios instance, arrow step or hook, assertion in a client or schema, secret in the tree, test that expects the buggy payload).

`Gaps` is everything else the guidelines require that is absent or incomplete.

Cite `path:line`. Quote the guideline section by number. If a section has no findings, omit it. Do not restate rules that passed.
