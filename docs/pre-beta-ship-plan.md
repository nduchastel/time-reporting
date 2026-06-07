# Pre-Beta-Ship Plan — QA Gate Before Launch

**Status:** PLANNED  
**Created:** 2026-06-06  
**Goal:** A go/no-go quality gate that runs **after Phase 4 is built and before the beta ships** to real customers. The beta does not launch until the gates below pass.

This phase sits between [`phase4-plan.md`](phase4-plan.md) and the beta launch. It builds **no new product features** — it verifies what Phase 4 delivered.

---

## Selected ship gates

Two gates were chosen as **blocking** for the beta (2026-06-06):

1. **Automated tests for all Phase 4 features**
2. **Manual QA script + device matrix**

A security review and a load/performance pass were considered and **deferred** (not blocking for beta) — see [Recommended but not gating](#recommended-but-not-gating).

---

## Gate 1 — Automated coverage for every Phase 4 feature

Extend the existing offline suite (unit + integration + smoke + Playwright; see `testing.md`) so each Phase 4 item has tests. Beta is blocked until all are green via `npm run test:all`.

| Phase 4 item | Tests to add |
|---|---|
| #1 Ownership auth on `GET /time-cards` | worker cannot read another worker's cards; manager/admin can; unauth → 401 |
| #2 Auth rate limiting | repeated failed logins → 429; successful login still works under the limit |
| #3 CORS lockdown | disallowed origin rejected; allowed origin passes |
| #4 JWT TTL | token carries role-correct `exp`; expired token rejected |
| #5 Supabase RLS | policy smoke (where testable against the fake / a real instance in CI) |
| #6 Error monitoring | reporter is a no-op when DSN unset; captures on thrown error when set (mocked) |
| #28 Admin user management | role boundaries (manager forbidden on `/api/admin/*`), create manager/admin, change role, reset credential, cannot delete self / last admin |
| #27 Panel visibility | backend defaults + ≥1 enforcement; worker UI renders only visible panels; manager toggle persists |
| #11 PWA | manifest served + valid; service worker registers; Lighthouse PWA installable check |
| #24–26 Onboarding | in-app help screens render; links/anchors resolve |

**Definition of done:** every row above has passing tests; `npm run test:all` is green; no `.skip` left on Phase 4 tests; coverage of new backend routes is meaningful (happy path + auth/role boundary + validation error).

---

## Gate 2 — Manual QA script + device matrix

A written, repeatable manual pass on **real devices** (the automated suite runs headless and can't validate install/mic/PWA behavior on actual phones).

### Device matrix

| Platform | Browser | Must verify |
|---|---|---|
| iOS (iPhone) | Safari | Add-to-Home-Screen install (#24), mic permission prompt, record→review→submit, history, PWA standalone launch |
| Android | Chrome | `beforeinstallprompt` install (#25), mic permission, full worker flow, PWA standalone launch |
| Desktop/laptop | Chrome + one of Safari/Firefox/Edge | Manager dashboard (#26): login, review/edit/flag/approve, worker CRUD, PIN reset, panel toggles (#27), reports + CSV; Admin portal (#28): create/edit/delete users, role change, credential reset |

### Manual test script (high level)

1. **Worker onboarding** — follow the iOS and Android guides verbatim; confirm a non-technical user could install and log in.
2. **Worker happy path** — record each *enabled* panel type; verify transcription/extraction/review/submit and that *disabled* panels (#27) are absent.
3. **Worker access** — confirm a worker only ever sees their own history.
4. **Manager flow** — review queue, edit a card, flag, approve; add a worker; reset a worker PIN; change a worker's visible panels; export CSV.
5. **Admin flow** — create a manager and an admin; change a user's role; reset a manager password; attempt to delete self and the last admin (both must be blocked); delete a test user.
6. **Auth/security spot-checks** — wrong PIN/password rejected; rate limit trips after repeated failures; logging out clears the session; expired/absent token blocked on protected routes.
7. **Error monitoring** — trigger a deliberate error in staging; confirm it lands in the dashboard with no PII.

**Definition of done:** the script passes on every matrix cell; issues are triaged as blocker / beta-acceptable; all blockers fixed and re-verified.

---

## Go / No-Go checklist

- [ ] `npm run test:all` green, including all new Phase 4 tests
- [ ] Manual QA script passed on all device-matrix cells
- [ ] No open **blocker** bugs
- [ ] Production env vars set (CORS origins, JWT secret, error-monitoring DSN, Supabase keys, OpenAI key)
- [ ] At least one `admin` seeded in production; manager account(s) created
- [ ] Rollback plan noted (revert to last good deploy on Vercel/Railway)
- [ ] Beta tester list + feedback channel ready

---

## Recommended but not gating

Considered and deliberately **deferred** so as not to block the beta (revisit before a wider/GA launch):

- **Security review / pen-test** of auth, ownership, role boundaries, and credential resets.
- **Load / performance smoke** on the voice pipeline and dashboards under realistic concurrency.

---

## Changelog

### 2026-06-06 — Plan created
Added as an explicit QA gate between Phase 4 and beta launch, at the user's request. Two blocking gates selected: automated coverage for all Phase 4 features, and a manual QA script across an iOS/Android/desktop device matrix. Security review and load testing were noted as recommended-but-not-gating for the beta.
