// scripts/cleanupJpgs.mjs  (or .js if "type":"module" is set)

import admin from 'firebase-admin'

const DRY_RUN = true

// If your script isn't already in a Firebase project root, you may need to
// supply credentials explicitly via GOOGLE_APPLICATION_CREDENTIALS env var.
admin.initializeApp({
  storageBucket: 'shredly-v5.firebasestorage.app',
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

async function deleteIfExists(url) {
  if (!url) return
  let path = url
  const m = /\/o\/([^?]+)\?/.exec(url)
  if (m) path = decodeURIComponent(m[1])
  if (DRY_RUN) {
    console.log('[DRY RUN] delete', path)
    return
  }
  await bucket.file(path).delete({ ignoreNotFound: true })
}

async function run() {
  const snap = await db.collection('photos').get()
  for (const doc of snap.docs) {
    const outputs = doc.data().outputs || {}
    let changed = false

    for (const key of ['sm', 'md', 'lg']) {
      if (outputs[key]?.jpg) {
        await deleteIfExists(outputs[key].jpg)
        delete outputs[key].jpg
        changed = true
      }
    }

    if (changed) {
      console.log(
        `${DRY_RUN ? '[DRY RUN] would update' : 'updating'} ${doc.id}`
      )
      if (!DRY_RUN) {
        await doc.ref.update({
          outputs,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
    }
  }
  console.log('Done.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
