# Supabase surface used by backend code

Audit of every chain shape used by `backend/src/**`. The fake only needs to
implement these. Anything outside this set should throw `not implemented: ...`.

## supabase.from('workers')
- `.select('id, name, language, pin, status, role').eq('phone', val).single()` — auth.js worker login
- `.select('id, name, role, password_hash, status').eq('username', val).single()` — auth.js manager login
- `.select('name').eq('id', val).single()` — timeCards.js POST
- `.select('name, language').eq('id', val).single()` — timeCards.js voice
- `.select('id, name, phone, language, role, status, created_at, updated_at').order('name', { ascending: true })` — manager.js list
- `.insert(row).select('id, name, phone, language, role, status').single()` — manager.js POST
- `.update(patch).eq('id', val).select('id, name, phone, language, role, status').single()` — manager.js PATCH

## supabase.from('worksites')
- `.select('id').ilike('name', '%val%').single()` — timeCards.js find-or-create

## supabase.from('time_cards')
- `.insert(row).select().single()` — timeCardService.createTimeCard
- `.select('*, workers(name), worksites(name)').order('created_at', { ascending: false })` then optionally chained:
    - `.eq('worker_id', val)`
    - `.eq('status', val)`
    - `.gte('date', val)`
    - `.lte('date', val)`
    - `.limit(n)` (always applied, clamped 1..1000)
- `.update(patch).eq('id', val).select('*, workers(name), worksites(name)').single()` — timeCardService.updateTimeCard

## supabaseAdmin.storage.from(BUCKET)
- `.upload(key, buffer, { contentType, upsert: false })` — storageService
- `.createSignedUrl(key, ttl)` — storageService

## Error codes the production code maps
- `PGRST116` → 404 (single() returns no rows)
- `23505` → 409 (unique violation, e.g. duplicate phone/username)
- `23514` → 400 (CHECK constraint)

## Notes
- `db/seed.js` does `.from('workers')` and `.from('worksites')` for seeding —
  this is a script, not a runtime path, so the fake doesn't need to match it.
- No `.maybeSingle()`, no `.delete()`, no `.rpc()` used in production code today.
  The fake includes them only as safety rails for future use.
