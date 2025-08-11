import admin from 'firebase-admin'
if (!admin.apps.length) admin.initializeApp({})
const args = process.argv.slice(2)
let uid = process.env.ADMIN_UID || null
for (let i=0;i<args.length;i++){
  const a = args[i]
  if (a.startsWith('--uid=')) uid = a.split('=')[1]
  else if (a === '--uid') uid = args[++i]
}
if(!uid){ console.error('Provide --uid=YOUR_UID or set ADMIN_UID'); process.exit(1) }
await admin.auth().setCustomUserClaims(uid, { admin: true })
console.log('✅ Set admin=true for uid:', uid)
process.exit(0)