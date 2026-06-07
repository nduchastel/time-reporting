# Security & Authentication

Plain-language reference for how login, passwords, PINs, and permissions work in the Time Reporting System. This is a **living doc** — keep it current as the auth model changes; no changelog.

Status legend: ✅ built today · 🔭 planned for Phase 4 (see [`phase4-plan.md`](phase4-plan.md)).

---

## Core principles

1. **We never store a password or PIN — only a one-way scramble of it (a bcrypt "hash").** ✅
   When a user types their secret, we scramble it the same way and compare scrambles. Nobody — not even someone with full database access — can read a stored secret back. (`backend/src/services/authService.js` → `hashSecret` / `verifySecret`, bcrypt, 10 rounds.)

2. **Two kinds of credentials, chosen by role.** ✅

   | Role | Logs in with | Stored as | Why |
   |---|---|---|---|
   | **Worker** | phone + **4–6 digit PIN** | `workers.pin` (bcrypt hash) | Fast to type on a phone in the field |
   | **Manager / Admin** | **username + password** | `workers.password_hash` (bcrypt hash) | Stronger secret for users who can change data and manage people |

   A worker only ever has a PIN; a manager/admin only ever has a username + password.

3. **Sessions are signed, expiring tokens (JWT).** ✅
   On successful login the server issues a JWT — think of it as a tamper-proof wristband. The browser stores it (localStorage) and sends it on every request as `Authorization: Bearer <token>`. The server trusts it because it's signed with `JWT_SECRET` (known only to the server). The token carries the user's id and **role**, and it expires after a set time. **Role is what gates access** — e.g. `#/admin` only opens if the token says `role: admin`; `/api/manager/*` requires `role` in `manager`/`admin`.

---

## Where the secret table lives

Everyone (worker, manager, admin) is a row in the **`workers`** table, distinguished by `role`:

| Column | Holds |
|---|---|
| `role` | `worker` \| `manager` \| `admin` |
| `phone` | worker login id |
| `pin` | bcrypt hash of a worker's PIN |
| `username` | manager/admin login id |
| `password_hash` | bcrypt hash of a manager/admin password |
| `status` | `active` \| `disabled` (disabled can't log in) |
| `must_change_credential` 🔭 | `true` until the user replaces their temporary secret on first login |

---

## Account lifecycle — who picks and stores each secret

This is the key flow. **Nobody types their own secret at signup. The person creating the account sets a *temporary* secret, hands it over, and the new user replaces it on first login.**

### 1. The very first admin (bootstrap) 🔭
There's no UI to create the first privileged user (chicken-and-egg), so the first admin is created by a **one-time `create-admin` script**: you run it, type the username + password *you* choose, it bcrypt-hashes the password and writes the admin row. You then log in normally. *(Today this is fully manual DB insert; the script is a Phase 4 task. `seed.js` currently creates only a sample worker with no credentials.)*

### 2. Creating other users
- **Admin creates a manager/admin** → admin sets a **temporary username + password**. Stored hashed; `must_change_credential = true`. ✅ creation exists for workers today; 🔭 admin-creates-manager/admin is Phase 4.
- **Manager (or admin) creates a worker** → sets a **temporary PIN** (or leaves blank and sets later). Stored hashed; `must_change_credential = true`. ✅ (`POST /api/manager/workers`).
- The creator communicates the temporary secret out-of-band ("your temp PIN is 1234").

### 3. First login — forced change (everyone) 🔭
On first login, **any** user whose `must_change_credential` is `true` must pick a new secret before doing anything else:
- workers pick a new **PIN**, managers/admins pick a new **password**.
- The new secret replaces the temporary one and `must_change_credential` is cleared.
- **Result:** the creator no longer knows the user's real secret — a manager can't later clock in as a worker, and an admin can't act as a manager.

### 4. Self-service change (anytime) 🔭
A logged-in user can change their own PIN/password from their account, without involving anyone else.

### 5. Reset (lockout recovery) ✅/🔭
If a user is locked out, a **manager** can reset a **worker's** PIN, and an **admin** can reset a **manager/admin** password. A reset issues a new *temporary* secret (sets `must_change_credential = true` again), so the same first-login flow repeats. ✅ worker PIN reset exists; 🔭 manager/admin password reset is Phase 4.

---

## Login endpoints

- `POST /api/auth/worker/login` — body `{ phone, pin }` → returns `{ token, worker }`. ✅
- `POST /api/auth/manager/login` — body `{ username, password }` → returns `{ token, user }`. ✅
  **Admins log in here too** — there is no separate admin login or admin password. An admin is simply a username/password user whose `role` is `admin`; the role in the token decides whether `#/admin` is reachable.

Both endpoints run a constant-time bcrypt comparison even when the phone/username isn't found, so attackers can't tell "wrong PIN" from "no such user" by response timing. ✅

---

## Roles & permissions

Who can do what is summarized in [`phase4-plan.md` → Roles & permission model](phase4-plan.md#roles--permission-model). In short: workers record their own time; managers approve/edit time cards and manage workers (incl. worker PIN reset and panel visibility); **only admins** create/delete users, change roles, and reset manager/admin passwords.

---

## What protects us, and what Phase 4 adds

**In place today** ✅
- bcrypt-hashed secrets (never plaintext, never logged)
- signed, expiring JWTs
- timing-equalized login (no user/phone enumeration)
- server-side role checks (`requireAuth([roles])`)

**Phase 4 hardening** 🔭 (see `phase4-plan.md`)
- **Rate limiting** on login endpoints — stops PIN/password brute-forcing
- **Shorter token lifetimes** — role-based TTL (proposed worker 7d, manager/admin 24h) instead of the current 30d
- **CORS lockdown** — only our real frontend origins may call the API
- **Supabase RLS** — database-level access rules as defense-in-depth

**Deliberately deferred (Phase 5+):** two-factor auth, SSO, and password-strength/breach checks. Tracked in `phase5-backlog.md`.

---

## Quick answers

- *Where is a password/PIN ever stored?* Only as a bcrypt hash in `workers.password_hash` / `workers.pin`. Never in plaintext, never in logs.
- *Who picks a new user's first secret?* Their creator sets a temporary one; the user replaces it on first login.
- *Do workers have passwords?* No — workers use phone + PIN only. Managers/admins use username + password only.
- *Is the admin login separate?* No — admins use the same username/password login; their `role` unlocks `#/admin`.
