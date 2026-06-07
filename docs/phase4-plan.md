# Phase 4 Implementation Plan — Beta Hardening, Admin & User Management

**Status:** PLANNED  
**Created:** 2026-06-06  
**Goal:** Get the app safe and complete enough to ship a **beta to real customers**. Phase 4 is the last *build* phase before launch; the [Pre-Beta-Ship QA gate](pre-beta-ship-plan.md) runs after it, then we ship. Everything not listed here is deferred to the [Phase 5 backlog](phase5-backlog.md).

---

## Scope summary

| # | Item | Area |
|---|---|---|
| 1 | Worker-ownership auth on `GET /api/time-cards` | Security |
| 2 | Rate limiting on `/api/auth/*` | Security |
| 3 | CORS lockdown to known origins | Security |
| 4 | JWT TTL tightening (role-based) | Security |
| 5 | Supabase RLS policies (defense-in-depth) | Security |
| 6 | Error monitoring (Sentry-style) | Observability |
| 11 | PWA install prompt (manifest + service worker) | Install |
| 24 | Worker install guide — iOS | Onboarding |
| 25 | Worker install guide — Android | Onboarding |
| 26 | Manager setup/config guide — browser | Onboarding |
| 27 | Per-worker panel visibility (IN/OUT/HOURS/OFF) | Worker config |
| 28 | Admin portal + full user management | Admin |
| 28a | Temporary credentials + forced first-login change (all roles) | Auth |
| 28b | Self-service change PIN/password | Auth |
| 28c | Bootstrap `create-admin` script (first admin) | Auth |

(Item numbers map to the master backlog discussed on 2026-06-06; they're kept for traceability across the phase docs.)

**The full authentication/credential model is documented in [`security.md`](security.md)** — read it before touching anything in Group C or Group F below.

---

## What's already built (Phases 1–3)

- Voice → Whisper transcription → GPT extraction → review-before-submit → DB storage.
- Worker PIN login; manager username/password login (JWT, timing-safe).
- Manager dashboard: review / edit / flag / approve; **worker** CRUD (soft-disable) incl. worker PIN reset; reports summary + CSV export.
- Audio upload to Supabase Storage with signed-URL playback.
- Full automated test suite (unit + integration + smoke + Playwright), all offline.

See `phase1-decisions.md`, `phase2-implementation-plan.md`, `phase3-plan.md`, and `testing.md`.

---

## Roles & permission model

Phase 4 formalizes three roles, all stored in the existing `workers` table via the `role` column.

| Capability | worker | manager | admin |
|---|:--:|:--:|:--:|
| Record time, view own history | ✅ | ✅ | ✅ |
| Approve / edit / flag time cards | — | ✅ | ✅ |
| CRUD workers, reset **worker** PIN | — | ✅ | ✅ |
| Configure per-worker panel visibility (#27) | — | ✅ | ✅ |
| Create / edit / delete **any** user (worker/manager/admin) | — | — | ✅ |
| Change a user's **role / permissions** | — | — | ✅ |
| Reset **manager/admin** passwords | — | — | ✅ |

**Bootstrap:** the first `admin` is seeded directly in the DB (same pattern managers use today). From then on, admins create everyone else through the portal.

---

## Task breakdown

### Group A — Security & access hardening

**Task 1 — Worker-ownership auth on `GET /api/time-cards`** (closes `TODO(Task 10)`)
- Add `requireAuth()` to the route.
- Workers may only read cards where `worker_id === req.user.sub`; ignore/override any `workerId` query param for worker tokens.
- Managers/admins may query any worker (keep current filter behavior).
- Update `frontend` worker-history fetch to rely on the token, not a client-supplied id.
- Tests: worker cannot read another worker's cards (403/empty); manager can.

**Task 2 — Rate limiting on auth endpoints**
- Add `express-rate-limit` (or equivalent) to `/api/auth/worker/login` and `/api/auth/manager/login` (and the new admin login if separate).
- Per-IP throttle (e.g. N attempts / window) returning 429; keep the existing constant-time compare.
- Tests: repeated failed logins eventually 429.

**Task 3 — CORS lockdown**
- Replace `app.use(cors())` with an allowlist from `ALLOWED_ORIGINS` env (comma-separated); default to the Vercel domain(s) + localhost for dev.
- Tests: disallowed origin is rejected; allowed origin passes.

**Task 4 — JWT TTL tightening**
- Replace the single `30d` TTL with role-based TTLs (proposed: worker 7d, manager/admin 24h).
- Decide re-auth UX (silent re-login vs prompt). No refresh-token infra in Phase 4 unless trivial.
- Tests: token carries expected `exp`; expired token rejected (already covered — extend for roles).

**Task 5 — Supabase RLS policies**
- Enable row-level security on `time_cards`, `workers`, `worksites`; add policies matching the server-side checks (defense-in-depth, since the API holds the keys).
- Document policies in `database-schema.md`.
- Note: verify the service-role path still works for admin operations.

### Group B — Observability

**Task 6 — Error monitoring**
- Integrate a hosted error tracker (Sentry-style) in **both** backend (Express error handler + unhandled rejections) and frontend (error boundary + window handlers).
- DSN via env; **no-op when unset** so tests/local stay offline.
- Scrub PII (no audio, no transcription text in error payloads).

### Group C — Admin portal & user management (#28)

**Decision:** Admin UI ships as a **gated `#/admin` route in the existing React app**, guarded by `role==='admin'` (chosen 2026-06-06). Not a separate deployment.

**Task 7 — Admin auth + route guard** (single login path — see `security.md`)
- **No separate admin login or admin credential.** Admins log in through the *existing* `POST /api/auth/manager/login` (username + password); the JWT's `role` decides access.
- `#/admin*` renders an `AdminApp`, guarded by `role === 'admin'`; managers and workers are redirected/denied. Managers continue to land on the existing dashboard.

**Task 8 — Backend user-management API** (`/api/admin/users`, `requireAuth(['admin'])`)
- `GET /users` — list all users across roles.
- `POST /users` — create worker/manager/admin with a **temporary** secret (sets `must_change_credential = true`). For manager/admin, collect `username` + temp `password` (bcrypt-hash); for worker, `phone` + temp `pin`.
- `PATCH /users/:id` — edit profile, **change role**, enable/disable.
- `POST /users/:id/reset-credential` — reset PIN (worker) or password (manager/admin) to a new temporary value (re-sets `must_change_credential = true`).
- `DELETE /users/:id` — hard delete, with guards: cannot delete self, cannot delete the last remaining admin.
- Reuse `hashSecret`/validation; map unique-violation (409) and not-found (404) like the manager route.
- Tests: role boundaries (manager forbidden), can't-escalate, can't-delete-last-admin, credential reset re-arms the first-login flow.

**Task 9 — Admin UI**
- User list with role/status filters; create/edit forms; role selector; reset-credential and delete actions with confirmation.
- Surface the temporary credential once for hand-off to the user (they'll be forced to change it on first login).

### Group D — Per-worker panel visibility (#27)

**Task 10 — Schema + backend**
- Add a `visible_panels` column to `workers` (e.g. `text[]` or `jsonb`), default `['IN','OUT','HOURS','OFF']`.
- Enforce **at least one** panel on (app-level validation; DB check if practical).
- Return `visible_panels` on worker login so the client knows what to render.
- Manager-editable via the existing worker PATCH (allowlist the field) — manager scope, not admin-only.

**Task 11 — Worker UI gating**
- `WorkerUI` renders only the action sections in `visible_panels`.
- Guard against an empty set (fallback to all, plus a logged warning).
- Tests: worker with `['HOURS']` sees only Hours; toggling re-renders.

**Task 12 — Manager UI control**
- In `WorkersView` / worker edit, add toggles for the four panels with the ≥1 constraint enforced in the form.

### Group E — Installability & onboarding

**Task 13 — PWA install (#11)**
- Add `manifest.webmanifest` (name, icons, theme, `display: standalone`, start URL) and a service worker (offline shell / cache-first for static assets; **no** time-card offline sync in Phase 4).
- Add an "Install app" prompt/affordance (handle `beforeinstallprompt` on Android; show iOS "Add to Home Screen" instructions).
- Verify installability via Lighthouse PWA checks.

**Task 14 — Onboarding guides (#24, #25, #26)**
- **#24 Worker — iOS:** step-by-step "Add to Home Screen" in Safari, mic permission, first login with phone + PIN.
- **#25 Worker — Android:** install via Chrome prompt, mic permission, first login.
- **#26 Manager — browser:** desktop/laptop login, dashboard tour, how to add workers, reset PINs, set panel visibility, run reports.
- Cover the **first-login change** step in each guide (worker picks a new PIN; manager picks a new password).
- Delivery: in-app help screens (preferred) and/or `docs/` pages; keep copy short and screenshot-ready. Decide rendering during build.

### Group F — Credential lifecycle (see [`security.md`](security.md))

Implements the agreed model: a creator sets a **temporary** secret → the user is **forced to change it on first login** (all roles) → users can **change their own** secret anytime → managers/admins can **reset** a locked-out user.

**Task 15 — Temporary credentials + forced first-login change (#28a)**
- Add a `must_change_credential` boolean to `workers` (default `false`; set `true` on create and on reset).
- Backend: a `POST /api/auth/change-credential` endpoint (authenticated) that sets a new PIN (worker) or password (manager/admin), validates it, hashes it, and clears the flag.
- Login response surfaces `must_change_credential`; protected routes/UI funnel the user to the change screen until it's cleared. Applies to **workers and managers/admins**.
- Tests: a freshly-created/reset user is forced to change before normal use; flag clears after change.

**Task 16 — Self-service change PIN/password (#28b)**
- "Change my PIN/password" available to any logged-in user (reuses the Task 15 endpoint with the old-secret check).
- Worker UI (change PIN) + manager/admin UI (change password).
- Tests: wrong current secret rejected; successful change requires the new secret next login.

**Task 17 — Bootstrap `create-admin` script (#28c)**
- A one-time CLI (e.g. `backend/src/db/create-admin.js`) that takes a username + password, bcrypt-hashes the password, and inserts an `admin` row (`must_change_credential` optional for the bootstrap admin).
- Documented in `security.md` and the deployment/setup docs so the first admin can be created on a fresh environment.

---

## Out of scope (→ Phase 5)

Audio retention automation, uptime monitoring, backup drills, bulk-approve, reports charts, PDF export, pull-to-refresh/offline cache, anomaly-detection engine, configurable rule engine, GPS, photos, crew entries, push notifications, payroll integration, offline sync, SSO/native mobile. See `phase5-backlog.md`.

Security review/pen-test and load testing were **not** selected as beta gates; they're noted as recommended-later in `pre-beta-ship-plan.md`.

---

## Progress Tracking

**Completed:** 0/17 tasks (0%)  
**Current:** Not started — planning approved 2026-06-06  
**Next:** Begin Group A (security), which also unblocks the Pre-Beta-Ship security expectations.

**Security:** 0/5 · **Observability:** 0/1 · **Admin:** 0/3 · **Panels:** 0/3 · **Install/Onboarding:** 0/2 · **Credential lifecycle:** 0/3

---

## Changelog

### 2026-06-06 — Plan created
Scope agreed after triaging the full remaining backlog: Phase 4 = beta-hardening (security #1–5, observability #6), admin portal + user management (#28, as a gated `#/admin` route), per-worker panel visibility (#27), PWA install (#11), and worker/manager onboarding guides (#24–26). Anomaly detection (#15) and all other items deferred to Phase 5. A dedicated Pre-Beta-Ship QA gate (automated P4 coverage + manual device-matrix QA) was added between this phase and beta launch.

### 2026-06-06 — Auth model settled (Group F added)
Clarified the credential model and added `security.md` as the authoritative reference. Decisions: workers use phone + PIN, managers/admins use username + password; **one login path** (admins use the manager username/password endpoint, role gates `#/admin` — no separate admin login, fixing the earlier ambiguity in Task 7). Creators set a **temporary** secret; **all roles are forced to change it on first login**; users can change their own secret anytime; managers/admins can reset locked-out users. New Group F (Tasks 15–17): forced first-login change + `must_change_credential`, self-service change, and a bootstrap `create-admin` script. Task count 14 → 17.
