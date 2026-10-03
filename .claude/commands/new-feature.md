# /new-feature

Build a new feature or bug fix end-to-end following the project's agentic workflow.
All implementation happens inside a git worktree so this session's main directory stays clean
and multiple features can run in parallel without interference.

**Usage:** `/new-feature <plain-English task description>`

---

## Step 1 — Sync with main

Run:

```bash
git pull origin main
```

Report whether the pull succeeded. If conflicts arise, stop and tell the user before continuing.

---

## Step 2 — Confirm branch name

Based on the task description, suggest a branch name:
- New functionality → `feature/<kebab-case-description>`
- Bug fix → `fix/<kebab-case-description>`

Present the suggestion. Ask the user to confirm or provide an alternative. Do not create anything until they confirm.

---

## Step 3 — Create worktree

Once the branch name is confirmed, run:

```bash
git worktree add "../Roomate-App-<branch-name>" -b <branch-name> main
```

This creates an isolated checkout at `../Roomate-App-<branch-name>/` branched from the latest `main`.
All file reads, edits, and writes for this feature must target that path — never the current working directory.

Confirm the worktree was created successfully before continuing.

---

## Step 4 — Ask clarifying questions

Read `CLAUDE.md` in full. Read `.cursor/rules/database-schema.mdc`. Then read all files likely relevant to the task.

After reading, ask the user every question needed to fully define the work. Do not guess. Cover all of these areas that apply:

**Behavior & scope**
- What exactly triggers this feature / what is the exact bug?
- What should happen on success? On failure?
- Are there states that should be no-ops (duplicate submit, race condition, etc.)?

**UI & UX**
- Exact layout — where does this live in the app, what does it look like?
- Loading state — spinner, skeleton, disabled button, or nothing?
- Empty state — what shows when there is no data yet?
- Error state — inline message, toast, modal, or silent?
- Mobile vs desktop — any differences in layout or behavior?
- Confirmation dialogs — required before any destructive action?

**Data & permissions**
- Which Supabase tables are read or written?
- Who can access this — all household members, owner only, specific roles?
- Should new tables or columns require RLS policies? Which rules?

**Edge cases**
- What happens if required data is missing?
- Concurrent edits — last-write-wins, optimistic lock, or ignore?
- Any rate limits, quotas, or maximum counts to enforce?

Do not proceed to Step 5 until the user has answered all questions you asked.

---

## Step 5 — Produce a plan

After clarifying questions are answered, output a concise plan:
- New files to create and their paths (relative to the worktree root)
- Existing files to modify and why
- Which CLAUDE.md patterns govern this work
- Schema changes required — new tables, new columns, new RLS policies, new indexes
- SQL migrations that the user must run manually (show them here as a preview)

**Stop. Wait for the user to confirm the plan before writing any code.**

---

## Step 6 — Implement in phases

Work through phases in order. After each phase, summarize exactly what was written and ask: **"Continue to next phase?"** Do not proceed until the user says yes.

All file paths in Edit/Write/Read calls must be absolute paths inside the worktree:
`/Users/brendanaucoin/Documents/Personal/Projects/Roomate-App-<branch-name>/...`

### Phase 1 — Types & DB

- Add or update types in `lib/types/`
- Add new locale keys to `locales/en.ts`
- Present all SQL (migrations, new tables, new columns, RLS policies, indexes) as code blocks with this notice:

```
⚠️ Run this SQL manually in the Supabase dashboard SQL editor.
Claude will never execute SQL — paste and run this yourself.
```

Never execute SQL. Never assume it has been run.

### Phase 2 — Services

- Implement business logic in `lib/services/`
- All DB queries: explicit columns only (no `select('*')`), joins over multiple queries, batch operations — no DB calls inside loops, no unnecessary `Promise.all` round trips

### Phase 3 — API routes

- Write thin route handlers in `app/api/`
- Each handler structure: validate input → `supabase.auth.getUser()` → call service → return `{ data }` or `{ error }`
- Every handler must have a top-level `try/catch` with correct HTTP status codes (400/401/403/404/409/500)
- All error strings must come from `locales/en.ts` — never hardcoded in response bodies

### Phase 4 — UI

- Build components, hooks, and pages
- Client components use `apiClient` from `lib/api/client.ts` — never `fetch()`
- Server components call services directly — no HTTP calls at all
- Custom hooks in `hooks/use*.ts`
- Icons use inline SVG from `@/components/icons` — never Tabler `ti-*` classes
- Navigation uses `ROUTES` constants — never hardcoded path strings
- Handle loading, error, and empty states explicitly in every data-fetching component

---

## Step 7 — Update documentation for schema changes

If any schema changes were made (new tables, new columns, new RLS policies, new indexes, new functions), update both documentation files inside the worktree:

### `.cursor/rules/database-schema.mdc`

Add or update the relevant sections — table definition, column list, RLS policy rules, FK relationships, service ownership. Match the existing format and detail level exactly.

### `CLAUDE.md` — Section 10 (Database Schema)

Update the **Summary** line to reflect any new table count, new table names, or new domain areas. Example:

```
**Summary:** 28 `public` tables — **16 with RLS**, **12 without** (...). Domains: ..., **fitness tracking** (added 2026-10-03).
```

Do not duplicate column-level detail in CLAUDE.md — that lives only in `database-schema.mdc`.

---

## Step 8 — Self-review checklist

Audit every changed file against `CLAUDE.md`. Report pass/fail on each:

- [ ] No `fetch()` in `app/(pages)/`, `components/`, or `hooks/`
- [ ] No `select('*')` in any Supabase query
- [ ] All user-facing strings in `locales/en.ts` — none hardcoded in JSX or API responses
- [ ] No DB calls inside loops; no avoidable `Promise.all` round trips
- [ ] Every API route handler has top-level `try/catch` with correct HTTP status
- [ ] No `any` types; all domain types in `lib/types/`
- [ ] Icons use inline SVG — no Tabler `ti-*` classes
- [ ] All navigation uses `ROUTES` constants
- [ ] `process.env.*` only in `lib/config.ts`
- [ ] Auth checks use `supabase.auth.getUser()`, not `getSession()`
- [ ] All SQL presented as manual blocks — none executed by Claude
- [ ] Schema changes documented in `database-schema.mdc` and `CLAUDE.md` section 10

Fix every failure before moving on. Re-report the full checklist after fixes.

---

## Step 9 — Final summary

Present a human-readable summary:

```
Files added:
  - <worktree-relative path>: <one-line description>

Files modified:
  - <worktree-relative path>: <what changed>

New API routes:
  - <METHOD> /api/<path>: <purpose>

New locale keys:
  - <key path>: "<value>"

Schema changes — run these manually:
  <SQL block(s) or "None">

Documentation updated:
  - database-schema.mdc: <what was added/changed>
  - CLAUDE.md section 10: <what was updated, or "No changes">
```

Then list **Edge cases to test manually**:

```
Edge cases to test:
  1. <Specific scenario — e.g. "Submit form with all fields empty">
  2. <Specific scenario — e.g. "Two members complete same task simultaneously">
  3. <Specific scenario — e.g. "Navigate away mid-form, return, resubmit">
  ... (list every non-obvious failure path)
```

---

## Step 10 — Wait for approval

Tell the user: **"Review the summary above. Reply 'approved', 'lgtm', or 'ship it' to commit and push — or 'start over' to discard."**

Do not run any git commands until the user explicitly approves.

---

## Step 11 — On approval

Run in order from inside the worktree using `git -C`:

```bash
git -C "../Roomate-App-<branch-name>" add <list specific files — never -A blindly>
git -C "../Roomate-App-<branch-name>" commit -m "<conventional commit: feat/fix/refactor: ...>"
git -C "../Roomate-App-<branch-name>" push origin <branch-name>
```

Report the pushed branch and remind the user to open a PR against `main`.

---

## Step 12 — On rejection or "start over"

Run:

```bash
git worktree remove "../Roomate-App-<branch-name>"
git branch -D <branch-name>
```

Inform the user: "Worktree and branch `<branch-name>` deleted. You are back on main."
