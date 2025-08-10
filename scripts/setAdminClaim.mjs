/**
 * One-time script to grant 'admin' custom claim to a user by UID.
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
 *   npm run set-admin -- --uid YOUR_UID
 */
import 'firebase-admin/auth'
import admin from 'firebase-admin'

const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=').map(s=>s.replace(/^--/,''))))
const uid = args.uid || process.env.ADMIN_UID
if(!uid){
  console.error('Provide --uid YOUR_UID or set ADMIN_UID env var.')
  process.exit(1)
}

if(!admin.apps.length){
  admin.initializeApp({})
}

try{
  await admin.auth().setCustomUserClaims(uid, { admin: true })
  console.log('✅ Set admin=true for uid:', uid)
  process.exit(0)
} catch(e){
  console.error('❌ Error setting admin claim:', e)
  process.exit(1)
}
