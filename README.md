# Shredly — Auth Upgrade (Email/Password + Admin)

This adds Firebase Auth with email/password, an Auth modal, and **admin-only** park editing.

## Setup
1) Install deps:
```bash
npm i
```

2) Create a Firebase project and update `src/lib/firebase.js` with your config.

3) Deploy rules (or use Emulator while developing):
```bash
firebase deploy --only firestore:rules,storage:rules
# or with emulator: firebase emulators:start
```

4) Create your personal account in the app (Sign up in the modal), get your UID from Firebase Console → Authentication.

5) Grant yourself admin:
```bash
# put a serviceAccount.json in project root (Service Accounts → Generate new key)
export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
npm run set-admin -- --uid YOUR_UID
```

6) Sign out and back in — your token will now include `admin: true`.

## What changed
- `AuthModal.vue`: email/password login & signup
- `authStore.js`: listens to auth state, loads custom claims, exposes `isAdmin`
- `AppHeader.vue`: shows login/logout; gates "Add a park" button to admins
- `firestore.rules`: only admin can write `/parks`; users can manage their own `/users/{uid}/visited/*`
- `storage.rules`: any signed-in user can upload images to `/parkPhotos/{parkId}/*` (public read)

## Next
- Park editor page (admin-only) writing to `/parks/{id}`
- Photo uploader component → Firebase Storage (with resize function to WebP/AVIF)
- MapLibre integration for real map view
