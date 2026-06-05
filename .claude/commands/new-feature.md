# /new-feature

Build a new feature or bug fix end-to-end following the project's agentic workflow.

**Usage:** `/new-feature <plain-English task description>`

---

## Step 1 — Sync with main

Run:

```
git pull origin main
```

Report whether the pull succeeded and note any conflicts if they arise.

---

## Step 2 — Confirm branch name

Based on the task description, suggest a branch name following these conventions:
- New functionality → `feature/<kebab-case-description>`
- Bug fix → `fix/<kebab-case-description>`

Present the suggestion to the user and ask them to confirm or provide an alternative. Do not create the branch until they confirm.

---

## Step 3 — Create the branch

Once the user confirms the branch name, run:

```
git checkout -b <confirmed-branch-name>
```

---

## Step 4 — Gather context and produce a plan

Read `CLAUDE.md` in full. Then read all files that are likely relevant to the task (existing routes, services, types, locale keys, components). Use your judgment about what is in scope.

After reading, output a concise plan that covers:
- What new files you will create and where
- What existing files you will modify and why
- Which patterns from CLAUDE.md govern this work (e.g. service extraction, apiClient, inline SVG icons)
- Any schema or migration changes required

**Stop here. Wait for the user to confirm the plan before writing a single line of code.**

---

## Step 5 — Implement in phases

Work through the following phases in order. After completing each phase, write a short summary of exactly what was written, then ask: **"Continue to next phase?"** Do not proceed until the user says yes.

### Phase 1 — Types & DB
- Add or update types in `lib/types/`
- Add new locale keys to `locales/en.ts`
- Note any required schema changes or migrations (do not run migrations — describe them for the user)

### Phase 2 — Services
- Implement business logic in `lib/services/`
- All DB queries must use explicit columns (no `select('*')`), joins over multiple queries, and batch operations — no DB calls inside loops

### Phase 3 — API routes
- Write thin route handlers in `app/api/`
- Each handler must follow this structure: validate input → auth check via `supabase.auth.getUser()` → call service → return `{ data }` or `{ error }`
- Every handler must have a top-level `try/catch`

### Phase 4 — UI
- Build components, hooks, and pages
- Client components use `apiClient` from `lib/api/client.ts` — never `fetch()`
- Server components call services directly — no HTTP calls
- Custom hooks go in `hooks/use*.ts`
- Icons use inline SVG from `@/components/icons` — never Tabler classes
- Navigation uses `ROUTES` constants — never hardcoded path strings

---

## Step 6 — Self-review checklist

Before presenting the final summary, audit every changed file against the rules in `CLAUDE.md`. Check each item and report pass/fail:

- [ ] No `fetch()` in `app/(pages)/`, `components/`, or `hooks/`
- [ ] No `select('*')` in any Supabase query
- [ ] All user-facing strings live in `locales/en.ts` — none hardcoded in JSX or API responses
- [ ] No DB calls inside loops; no avoidable `Promise.all` round trips
- [ ] Every API route handler has a top-level `try/catch` with correct HTTP status codes
- [ ] No `any` types; all domain types defined in `lib/types/`
- [ ] Icons use inline SVG components — no Tabler `ti-*` classes
- [ ] All navigation uses `ROUTES` constants
- [ ] `process.env.*` only appears in `lib/config.ts`
- [ ] Auth checks use `supabase.auth.getUser()`, not `getSession()`

Fix every violation before moving on. Re-report the checklist after fixes so the user can see all items pass.

---

## Step 7 — Final summary

Present a human-readable change summary:

```
Files added:
  - <path>: <one-line description>

Files modified:
  - <path>: <what changed>

New API routes:
  - <METHOD> /api/<path>: <purpose>

New locale keys:
  - <key path>: "<value>"

Schema changes needed:
  - <describe any migrations, new tables, new columns, or RLS policy changes>
  - "None" if no schema changes
```

---

## Step 8 — Wait for approval

Tell the user: **"Please review the summary above. Reply with 'approved', 'lgtm', 'ship it', or similar to push — or 'start over' to discard this branch."**

Do not run any git commands until the user responds.

---

## Step 9 — On approval

Run in order:

```
git add <list the specific files — never git add -A blindly>
git commit -m "<conventional commit message>"
git push origin <branch-name>
```

Use a conventional commit message format: `feat: ...`, `fix: ...`, `refactor: ...`, etc.

Report the pushed branch and remind the user to open a PR.

---

## Step 10 — On rejection or "start over"

Run:

```
git checkout main
git branch -D <branch-name>
```

Inform the user: "Branch `<branch-name>` has been deleted. You're back on main."
