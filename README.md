# Shredly — Starter A (Vue 3, no TS, plain CSS)

Mobile‑first, lightweight starter for the skatepark app. No TypeScript, no Tailwind — just Vue 3 + Pinia and CSS design tokens.

## Quick start
```bash
npm i
npm run dev
```

## What’s inside
- **Vue 3 + Vite** (no TS)
- **Pinia** store with localStorage tracking for visited parks (works offline)
- **Design tokens** in `src/styles/tokens.css`, tiny utilities in `src/styles/utils.css`
- **Components**: `AppHeader`, `ParkCard`, `MapView` (stub)
- **Page**: `HomeView` with search, demo cards, and map placeholder
- **Fonts**: Karla (UI), Sedgwick Ave Display (park names), Sonsie One (logo)

## Where to add real data
- Replace `bootstrapDemo()` in `src/store/parksStore.js` with your importer (Overpass → Firestore).
- For Firebase, uncomment `src/lib/firebase.js` and wire into your stores/components.

## Color & theme
Tokens are in CSS variables — easy to tweak:
```css
:root{ --bg:#101827; --accent:#ff3ea5; /* etc */ }
```

## Suggested Firestore structure (later)
```
/parks/{parkId} {
  name, address, lat, lng, sizeSqft, builder, openedYear, hours, tags[], osmId,
  geohash, createdAt, updatedAt
}
/users/{uid}/visited/{parkId} { visitedAt }
```
You can keep the public “visited” count as an aggregate field on `/parks` via a Cloud Function.

## Basic rules (sketch)
```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /parks/{parkId} {
      allow read: if true;
      allow create, update: if request.auth != null; // or stricter moderation
    }
    match /users/{uid}/visited/{parkId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

```
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /parkPhotos/{parkId}/{imageId} {
      allow read: if true; // public
      allow write: if request.auth != null; // add size/type checks
    }
  }
}
```

## Map
Swap `components/MapView.vue` with MapLibre when ready:
```bash
npm i maplibre-gl
```
Then mount a map using your tokens (dark background + pink markers).

–– Have fun!
