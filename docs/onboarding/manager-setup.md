# Manager guide — setup & daily use (browser)

How to sign in, add your crew, and review time. Managers work on a
laptop/desktop browser (no install needed). **Living doc — keep current.**

> You need: the app address, plus a **username** and **temporary password** from
> your admin. (The very first admin is created with the `create-admin` script —
> see [`../security.md`](../security.md).)

## 1. Sign in + pick your own password
1. Go to the app address and open **Manager Sign In** (add `#/manager` to the URL
   if you land on the worker screen).
2. Enter your **username** and **temporary password**.
3. You'll be asked to **change your password** immediately — choose a strong one
   (min 8 characters) that only you know, and confirm it.

## 2. Add your worksites
**Worksites** → **Add worksite**. Enter name (and optional address/client).
Voice entries that mention a site are matched to it, so reports group by site.
- To retire a site, use **Archive** (not delete) — past time cards keep their
  link; archived sites stop showing in pickers. **Unarchive** brings it back.

## 3. Add your workers
**Workers** → **Add worker**:
1. Enter **name** and **phone number**.
2. Set a **temporary PIN** (4–6 digits) and hand it to the worker — they'll be
   forced to choose their own PIN on first login (you won't know their real PIN).
3. **Visible panels:** when editing a worker, check which actions they see —
   **Check IN / Check OUT / Hours Worked / Time OFF** (at least one). Crews that
   only log totals can be limited to **Hours Worked**, for example.
4. **Reset a PIN** anytime from the worker's row — it issues a new temporary PIN
   and re-prompts them to set their own on next login.
5. **Disable** a worker to block sign-in without deleting their history.

## 4. Review & approve time
**Review** lists submitted cards. For each you can:
- **Approve** as-is,
- **Edit** the hours/site/time (saved as *edited*, original transcription kept),
- **Flag** with a note for follow-up.

## 5. Reports
**Reports** summarizes hours by worker and by worksite for a date range, with a
**CSV export** for payroll.

## Admins
If your account is an **admin**, an **Admin** link appears in the nav → full user
management (create/edit/delete any user, change roles, reset manager/admin
passwords). See [`../security.md`](../security.md) for the full model.

## Trouble?
- **Landed on the worker screen:** add `#/manager` (or `#/admin`) to the URL.
- **Forgot your password:** an admin can reset it; you'll set a new one on next login.
