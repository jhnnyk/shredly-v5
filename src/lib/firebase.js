import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

// Fill these with your real project values
const firebaseConfig = {
  apiKey: 'YOUR_KEY',
  authDomain: 'YOUR_APP.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_BUCKET.appspot.com',
  messagingSenderId: '...',
  appId: '...'
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)