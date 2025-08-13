import admin from 'firebase-admin'
import serviceAccount from '../serviceAccount.json' assert { type: 'json' }

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

// Photos → photosCount
const photosSnap = await db
  .collection('photos')
  .where('status', '==', 'ready')
  .get()
const perParkPhotos = {}
photosSnap.forEach((d) => {
  const parkId = d.get('parkId')
  if (!parkId) return
  perParkPhotos[parkId] = (perParkPhotos[parkId] || 0) + 1
})
const batch1 = db.batch()
Object.entries(perParkPhotos).forEach(([parkId, n]) => {
  batch1.set(db.doc(`parks/${parkId}`), { photosCount: n }, { merge: true })
})
await batch1.commit()

// Visits → visitorsCount
const parksTally = {}
const usersSnap = await db.collection('users').get()
for (const u of usersSnap.docs) {
  const vs = await db.collection(`users/${u.id}/visited`).get()
  vs.forEach((v) => {
    parksTally[v.id] = (parksTally[v.id] || 0) + 1
  })
}
const batch2 = db.batch()
Object.entries(parksTally).forEach(([parkId, n]) => {
  batch2.set(db.doc(`parks/${parkId}`), { visitorsCount: n }, { merge: true })
})
await batch2.commit()

console.log('Backfill done')
process.exit(0)
