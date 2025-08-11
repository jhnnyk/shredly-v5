# Shredly — Bottom Navigation + Map & Profile

Mobile-first layout with a fixed bottom nav (Home / Map / Profile), MapLibre map centered on the user, nearest parks list, and a Profile page with stats. Admin routes remain protected.

## Run
```bash
npm i
npm run dev
```

## Configure
- Fill `src/lib/firebase.js` with your project keys.
- Grant yourself admin: `npm run set-admin -- --uid=YOUR_UID`.

## Routes
- `/` Home — search + list
- `/map` Map — user-centered map + nearest parks
- `/me` Profile — user info, visited count; if admin, links to add/manage parks
- `/admin/parks` and `/admin/parks/:id` — admin-only CRUD