# NEXUS Split — Master Development & Handoff Spec

> Historical repository snapshot. The user-designated authoritative continuity file is `C:\Users\User\Downloads\NEXUS_SPLIT_MASTER_DEVELOPMENT_SPEC_FULL_HANDOFF.md`, updated through TASK 16 / V1.0 on 2026-10-06. Use that file for future continuation.

> Product: NEXUS Split  
> NEXUS module: System 03  
> Primary platform: mobile-first web application  
> Reference width: 390px  
> Current milestone: TASK 16 complete — V1.0  
> Exact next milestone: V1.1 planning only; no automatic continuation  
> V1 progress: 15 of 15 milestones (100%)  
> Last updated: 2026-10-06

## 1. How to use this document

This is the continuity document for NEXUS Split. Give this file to a new ChatGPT/Codex account before asking it to continue development.

The next agent must:

1. Read this document completely.
2. Inspect `git status`, repository instructions, current migrations, and the files named below.
3. Preserve all existing and uncommitted work. Do not assume the checkout is clean or that prior work has been committed.
4. Treat completed milestones as implemented; verify them rather than rebuilding them.
5. Continue only from **Current Next Task** unless the user explicitly changes scope.
6. Run the required regression suite before declaring a task complete.
7. Update this same document after every completed task.

If this document and the implementation disagree, inspect the implementation and tests, report the discrepancy, and correct this document as part of the task. Do not silently discard working code.

Suggested continuation prompt:

```text
This is the master development and handoff spec for System 03 — NEXUS Split.
Treat it as the project continuity source of truth. Inspect the current repository
before changing it, preserve uncommitted work, do not redo completed tasks, and
continue only from "Current Next Task". Update this same spec when the task passes.
```

## 2. NEXUS product boundaries

```text
NEXUS
├── System 01 — Resume Builder
├── System 02 — Mahjong
└── System 03 — NEXUS Split
```

NEXUS Split is an independent product domain designed to remain extractable:

```text
Frontend       apps/web/src/app/split/
Backend        apps/api/src/split/
Database       split_*
Configuration  SPLIT_*
```

It must not depend on Resume identity/repositories/API services or Mahjong accounts, sessions, bearer tokens, storage, or React components.

### Authentication boundary

```text
System 01 → existing Resume identity/data
System 02 → mahjong_accounts and Mahjong authentication
System 03 → split_users, split_sessions, Split authentication
```

Separate accounts across the three systems are intentional. NEXUS Split V1 has no SSO or account linking.

## 3. Technology and repository architecture

```text
nexus/
├── apps/
│   ├── web/       Angular 21
│   ├── api/       NestJS 12 + Fastify
│   └── mahjong/   React + Vite
├── packages/
│   └── shared/
├── infra/
│   └── migrations/
└── docs/
```

Persistence uses PostgreSQL through `pg`, without an ORM. SQL migrations are applied lexically by `apps/api/src/database/migrate.ts` and tracked in `schema_migrations`.

Key implementation entry points:

```text
apps/api/src/split/split.module.ts
apps/api/src/split/persistence/split.repository.ts
apps/api/src/split/persistence/postgres-split.repository.ts
apps/web/src/app/split/split.routes.ts
apps/web/src/app/split/data-access/split-api.service.ts
apps/web/src/app/split/data-access/split-groups.store.ts
apps/web/src/app/split/ui/split-bottom-sheet.component.ts
```

## 4. Mobile-first product contract

Priority is Mobile → Tablet → Desktop. Mobile information architecture is canonical; larger layouts adapt without changing workflows.

Required validation widths:

```text
Primary:   375px, 390px, 430px
Secondary: 768px, 1024px, 1440px
```

UI requirements:

- `100dvh` and safe-area support.
- No horizontal overflow.
- Minimum 44px touch targets; prefer 48–56px primary controls.
- Inputs use at least 16px text.
- Single-column primary mobile layouts and keyboard-safe forms.
- Mobile selectors use accessible Bottom Sheets rather than tiny desktop selects.
- Split styling stays independent from Resume and Mahjong CSS.
- Lucide Angular is the icon system; database rows store semantic types, not icon URLs.

Latest browser viewport checks passed at all six widths with no horizontal overflow. Mobile visible controls measured at least 52px in the checked state.

## 5. Completed milestones

### TASK 01 — Existing project audit

Status: **COMPLETE**

Confirmed the Angular/NestJS/Fastify/PostgreSQL architecture, migration mechanism, project boundaries, responsive infrastructure, and correct integration locations.

### TASK 02–03 — Standalone authentication architecture and design

Status: **COMPLETE**

Split authentication was deliberately separated from Systems 01 and 02. The standalone identity/session design was accepted before implementation.

### TASK 04 — Standalone Split authentication implementation

Status: **COMPLETE**

Migration:

```text
infra/migrations/003_nexus_split_auth.sql
```

Tables:

```text
split_users
split_sessions
```

Implemented:

- Argon2id password hashing.
- Opaque PostgreSQL sessions with idle and absolute expiry.
- Multiple independent device sessions and revocation.
- Split-only authentication guards and current-user/session decorator.
- HttpOnly session cookie.
- Angular auth state, login, registration, guards, and session restoration.
- No session or CSRF token in `localStorage` or `sessionStorage`.

Production cookie:

```text
__Host-nexus_split_session
HttpOnly; Secure; SameSite=Lax; Path=/; no Domain
```

Auth API:

```text
POST /api/split/auth/register
POST /api/split/auth/login
POST /api/split/auth/logout
GET  /api/split/auth/me
```

### TASK 05 — Authentication stabilization

Status: **COMPLETE**

CSRF is stable for the lifetime of one session:

```text
HMAC-SHA256(SPLIT_CSRF_SECRET, split_sessions.id)
```

Consequences:

- Repeated `/me` calls and multiple tabs share a stable valid CSRF token.
- A new session ID produces a different CSRF token.
- Logout/revocation invalidates both session and CSRF capability.
- CSRF comparison is timing-safe and Origin validation remains mandatory.
- `csrf_token_hash` was removed from migration 003 before deployment.

Required environment variable:

```text
SPLIT_CSRF_SECRET
```

It is a dedicated secret and must not reuse a password pepper or unrelated secret.

### TASK 06 — Group, Member, Invite foundation

Status: **COMPLETE**

Migration:

```text
infra/migrations/004_nexus_split_groups.sql
```

Tables:

```text
split_groups
split_group_members
split_invites
split_activity_logs
```

Implemented domain rules:

- Group ownership is authoritative through `split_group_members.role = owner`; `created_by_user_id` is audit data only.
- Each Group is created transactionally with one active registered Owner and `GROUP_CREATED` activity.
- Roles: `owner`, `member`.
- Membership states: `active`, `left`, `removed`.
- Guests use `user_id = NULL`, role `member`, and cannot authenticate.
- Registered users have at most one membership row per Group.
- A Group has at most one active Owner.
- Member removal is a soft state transition.
- Invite tokens are cryptographically random; only SHA-256 hashes are stored.
- Generic Invite claims create registered memberships.
- Targeted Guest claims link the existing Guest membership and preserve its Member ID.
- Invite claim locks relevant rows to prevent double claiming.
- Archived Groups remain readable and are mutation-blocked except for reopen.
- Cross-Group inaccessible resources return 404; known non-owner access to owner actions returns 403.

Supported Group types:

```text
travel, daily, home, couple, food, project, other
```

Supported application currencies:

```text
MYR, USD, SGD, CNY, TWD, JPY, HKD
```

Group API:

```text
POST /api/split/groups
GET  /api/split/groups?status=active|archived
GET  /api/split/groups/:groupId
PATCH /api/split/groups/:groupId
POST /api/split/groups/:groupId/archive
POST /api/split/groups/:groupId/reopen
```

Member API:

```text
GET    /api/split/groups/:groupId/members
POST   /api/split/groups/:groupId/members/guest
DELETE /api/split/groups/:groupId/members/:memberId
```

Invite API:

```text
POST   /api/split/groups/:groupId/invites
GET    /api/split/groups/:groupId/invites
DELETE /api/split/groups/:groupId/invites/:inviteId
GET    /api/split/invites/:token/preview
POST   /api/split/invites/:token/claim
```

Current activity action types:

```text
GROUP_CREATED, GROUP_UPDATED, GROUP_ARCHIVED, GROUP_REOPENED
MEMBER_ADDED, MEMBER_REMOVED, MEMBER_JOINED
INVITE_CREATED, INVITE_REVOKED, INVITE_CLAIMED
```

### TASK 07 — Mobile-first Group experience

Status: **COMPLETE**

Routes:

```text
/split
/split/login
/split/register
/split/groups
/split/groups/new
/split/groups/:groupId
/split/groups/:groupId/members
/split/groups/:groupId/settings
/split/invite/:token
```

`/split` routes authenticated users to `/split/groups` and anonymous users to `/split/login`. The public Invite route remains accessible without authentication. The System 03 Universe entry is enabled as `NEXUS Split → /split`.

Implemented UI:

- Active/Archived Group tabs with local caching.
- Loading skeletons, error states, and separate empty states.
- Group cards with semantic type, name, active Member count, base currency, and optional dates.
- Mobile Create Group form with type and currency Bottom Sheets.
- Frontend validation and duplicate-submit prevention.
- Group Detail with compact header, Member preview, read-only archived state, and disabled `Add Expense — Coming Next` CTA.
- Members screen with Owner/Member/Guest labels and removed members hidden by default.
- Owner-only Add Member controls, Guest creation, generic Invite, and targeted Guest Invite.
- Transient Invite URL, clipboard copy, and Web Share with copy fallback.
- Public Invite preview, authentication return URL, explicit claim, state handling, and successful Group navigation.
- Owner Settings, archive confirmation, archived badge, and reopen.
- Split-local accessible Bottom Sheet with dialog semantics, initial focus, Escape/backdrop close, focus restoration, scroll locking, safe-area padding, scrolling, and reduced motion.

Frontend data access:

```text
apps/web/src/app/split/data-access/split.models.ts
apps/web/src/app/split/data-access/split-api.service.ts
apps/web/src/app/split/data-access/split-groups.store.ts
```

HTTP logic stays outside page components and does not use Resume `ApiService`.

Backend additions made for TASK 07:

- Group list returns `memberCount` and `currentUserRole` in one query, avoiding per-card Member requests.
- Removed/left registered Members rejoin through a fresh generic Invite by reactivating their existing row and preserving Member ID.
- Active duplicate membership claims are rejected.
- A targeted Guest claim conflicts with any other existing membership identity in that Group.
- Invite preview uses safe stable error codes for expired, revoked, claimed, and missing states.

## 6. Current schema and migration sequence

```text
001_foundation.sql
002_resume_documents.sql
003_nexus_split_auth.sql
004_nexus_split_groups.sql
005_nexus_split_expenses.sql
```

No `006_nexus_split_settlements.sql` exists yet.

System 03 tables remain isolated under the `split_` prefix and reference `split_users`, never central/Resume/Mahjong users.

## 7. Authorization matrix

| Capability | Owner | Registered Member | Guest |
|---|---:|---:|---:|
| Read accessible Group | Yes | Yes | No application access |
| Create Expense later | Yes | Yes | No |
| Edit/delete any Expense later | Yes | No | No |
| Edit/delete own Expense later | Yes | Yes | No |
| Record Settlement later | Yes | Yes | No |
| Add Guest / create Invite | Yes | No | No |
| Remove Member | Yes | No | No |
| Edit Group Settings | Yes | No | No |
| Archive / reopen | Yes | No | No |

Every protected resource query is scoped by authenticated Split user plus active registered membership. Client-supplied `userId`, `ownerUserId`, and `createdByUserId` are never authorization sources.

## 8. Financial invariants for future tasks

These rules are mandatory.

### Payments and shares are separate

Who paid is independent of who participated. A payer need not be a participant.

Example:

```text
Samuel pays RM100.
Participants: John and Amy.
John owes Samuel RM50; Amy owes Samuel RM50.
```

### Canonical money storage

Never use JavaScript floating point as canonical financial storage. Store integer minor units:

```text
RM30.55 → 3055
```

Currency precision must be explicit; do not assume every currency has two minor digits.

### Deterministic rounding

Allocations must always sum to the original amount:

```text
RM10 / 3 → RM3.34, RM3.33, RM3.33
```

The remainder allocation order must be deterministic and tested.

### Expense permissions

- Owner may edit/delete any Expense.
- Member may edit/delete only an Expense they created.
- Guest has no application access.
- Settlement does not permanently lock Expenses in V1.
- Editing an Expense recalculates derived balances and records Activity.

### Settlement semantics

- Owner and Member may record authorized Settlements.
- Settlement records an external payment; NEXUS Split does not initiate bank/e-wallet transactions.
- Partial settlement reduces the outstanding amount without rewriting Expense history.

### Deletion policy

Preserve financial, membership, Invite, and Activity history with soft-state approaches. Hard deletion requires explicit future approval and a documented history policy.

## 9. Current verification status

Latest confirmed automated results after TASK 08:

```text
API tests       49 / 49 passing
Web tests        7 / 7 passing
Mahjong tests   29 / 29 passing
Typecheck       passing
API build       passing
Web build       passing
git diff --check passing
```

Required regression commands:

```text
npm test
npm run typecheck
npm run build --workspace @nexus/api
npm run build --workspace @nexus/web
git diff --check
```

Mahjong tests must remain green. Resume Studio and Mahjong behavior are outside Split work unless the user explicitly changes scope.

## 10. Known infrastructure blocker

Local PostgreSQL was unavailable at the latest check:

```text
connect ECONNREFUSED 127.0.0.1:5433
```

Consequently, real database execution has not yet verified migrations 003–005, persisted Split authentication, Group/Guest CRUD, Invite claim, membership reactivation, or Expense CRUD and session restoration against PostgreSQL.

Until a local/development PostgreSQL instance is already available:

- Run all static/unit/build checks that do not require it.
- Do not install PostgreSQL or start Docker merely to satisfy a task.
- Do not modify production configuration or touch the production database.
- Report database and browser E2E verification as pending.

The TASK 07 responsive browser check covered public/error states and layout metrics. Authenticated database-backed browser flows remain pending for the same infrastructure reason.

## 11. V1 roadmap

```text
✓ Project audit
✓ Standalone authentication architecture
✓ Authentication implementation
✓ Authentication hardening
✓ Group / Member / Invite foundation
✓ Mobile Group experience
✓ TASK 08 — Expense database + calculation engine

□ TASK 09 — Mobile Expense experience
□ TASK 10 — Balance / debt engine
□ TASK 11 — Settlement system
□ TASK 12 — Activity timeline
□ TASK 13 — Multi-currency and exchange rates
□ TASK 14 — Search / filter / UX hardening
□ TASK 15 — PostgreSQL and full E2E verification
□ TASK 16 — Production readiness
```

### TASK 08 — Expense database + money calculation engine

Status: **COMPLETE**

Create only:

```text
infra/migrations/005_nexus_split_expenses.sql
split_expenses
split_expense_payments
split_expense_splits
```

Implement in this order:

```text
Money/currency utilities
→ Expense schema and repository contract
→ Equal allocation
→ Exact allocation
→ Percentage allocation
→ Shares allocation
→ Multiple payers and payer-not-participant support
→ Expense create/edit/soft-delete API
→ Activity writes
→ Automated financial tests
```

TASK 08 completion criteria:

- Canonical amounts and allocations use integer minor units.
- Currency precision is explicit.
- Every split strategy deterministically sums to the Expense total.
- All validation and authorization rules are enforced by the backend.
- Expense writes and Activity changes are transactional.
- No Balance, Settlement, exchange-rate fetching, receipt upload, analytics, or production migration is introduced.
- The full regression suite passes.
- This Master Spec is updated.

Implemented results:

- Added `005_nexus_split_expenses.sql` with UUID-keyed `split_expenses`, `split_expense_payments`, and `split_expense_splits`, financial checks, same-Group composite foreign keys, lookup indexes, soft deletion, and Expense Activity event/entity constraints.
- Added integer-minor-unit money utilities with explicit precision for MYR, USD, SGD, CNY, TWD, HKD, and JPY. Explicit exchange-rate conversion uses decimal parsing plus integer arithmetic and deterministic half-up rounding; no live exchange-rate fetching was added.
- Added deterministic Equal, Exact, Percentage (basis points), and Shares allocation engines. Payments and participant allocations are independently required to sum to the original Expense amount, and stable input order controls remainder distribution.
- Added authenticated Expense create, list, detail, edit, and soft-delete APIs beneath `/api/split/groups/:groupId/expenses`, retaining Split session, Origin, CSRF, membership, archive, and owner/creator authorization boundaries.
- Expense writes and their Activity records share PostgreSQL transactions. Owners may edit/delete any Expense; active registered Members may edit/delete only Expenses they created.
- New and edited Expenses accept only active Members from the same Group. Guests remain valid payers and participants, and a payer does not need to be a participant.
- Group base currency becomes immutable after the first non-deleted Expense. No Balance, Debt, Settlement, receipt, analytics, frontend Expense flow, or production migration was introduced.
- `split_expense_payments` and `split_expense_splits` intentionally carry `group_id` in addition to `expense_id`; this enables database-enforced composite foreign keys proving both the Expense and referenced Member belong to the same Group.
- Automated coverage includes allocation determinism, currency precision/conversion, payment and split totals, guest and cross-Group validation, archived Groups, owner/member permissions, reads, edits, soft deletion, Activity behavior, and base-currency locking.
- Local migration execution was attempted through the existing mechanism and stopped at `ECONNREFUSED 127.0.0.1:5433`; PostgreSQL migration and smoke-test verification remain pending without starting or installing infrastructure.

### TASK 09 — Mobile Expense experience

Status: **NOT STARTED — CURRENT NEXT TASK**

Add Expense, category, amount, currency, payer(s), participants, Equal/Exact/Percentage/Shares flows, Expense list/detail/edit/delete. Build at 390px first. Begin only after TASK 08 passes.

### TASK 10 — Balance and debt engine

Status: **NOT STARTED**

Implement total paid, total share, net balance, pairwise debt, who-owes-whom, and optional debt simplification.

Acceptance example before settlements:

```text
Expense 1: RM30, Samuel paid, Samuel/John/Amy equally
Samuel +20, John -10, Amy -10

Expense 2: RM3, John paid, Samuel/John/Amy equally
Samuel +19, John -8, Amy -11

Simplified: John → Samuel RM8; Amy → Samuel RM11
```

### TASK 11 — Settlement system

Status: **NOT STARTED**

Create `006_nexus_split_settlements.sql`. Support full/partial Settlement and methods Cash, DuitNow, Bank Transfer, E-wallet, Other.

### TASK 12 — Activity timeline

Status: **NOT STARTED**

Add `EXPENSE_CREATED`, `EXPENSE_UPDATED`, `EXPENSE_DELETED`, and `SETTLEMENT_CREATED`; implement read API and mobile timeline.

### TASK 13 — Multi-currency and exchange rates

Status: **NOT STARTED**

Store original currency/amount, final rate used, and base amount. Suggested rates may be overridden; historical rates never change automatically. Lock Group base currency after financial history exists.

### TASK 14 — Search, filters, and UX hardening

Status: **NOT STARTED**

Add Expense search and category/payer/member/currency/date filters. Complete loading/error/empty states, large-number and long-name handling, keyboard behavior, mobile accessibility, and destructive-action UX.

### TASK 15 — PostgreSQL and full E2E verification

Status: **NOT STARTED**

When development PostgreSQL is available, apply migrations 001–006 and test persistence across browser refresh for auth, Group, Guest, Invite, Expense, Balance, and Settlement.

Financial E2E must include:

```text
RM30 equal Expense: Samuel +20, John -10, Amy -10
Then RM3 paid by John: Samuel +19, John -8, Amy -11
Then John settles RM5 to Samuel: Samuel +14, John -3, Amy -11
```

### TASK 16 — Production readiness

Status: **NOT STARTED**

Review authentication, authorization, IDOR, CSRF, CORS, rate limits, session cleanup, validation, migration safety, logging, HTTPS, secrets, mobile QA, builds, tests, and console errors.

Deferred advisories requiring compatibility review rather than blind upgrades:

```text
Angular Router advisory
fast-uri advisory
```

## 12. Explicitly deferred beyond V1

Add only with explicit approval:

```text
Receipt upload/preview/OCR and AI recognition
Automatic category detection
Recurring Expenses and budgets
Monthly analytics and charts
Push notifications
Offline sync
Bank/card/DuitNow payment integrations
CSV, Excel, and PDF exports
AI spending advice
```

Receipt upload is currently the first planned V1.1 enhancement.

## 13. Progress update protocol

After every completed task, update this document in place:

1. Mark the task complete and record what was actually implemented.
2. Record every migration, table, constraint, index, API, and frontend route added or changed.
3. Record authorization, transaction, and data-lifecycle decisions.
4. Record tests added and the latest exact test counts.
5. Record responsive/browser and real-database verification separately.
6. Preserve every unresolved issue and infrastructure blocker.
7. Update completed/remaining milestone counts and approximate progress.
8. Promote exactly one milestone to **Current Next Task**.
9. Keep future tasks future-facing; never describe planned behavior as implemented.
10. Stop at the requested task boundary.

This file remains the single continuing progress document:

```text
docs/NEXUS_SPLIT_MASTER_DEVELOPMENT_SPEC.md
```
