import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyCs3GdXMgjQALYE9F9Kq8nIT_pSPv_R84U',
  authDomain: 'shredly-v5.firebaseapp.com',
  projectId: 'shredly-v5',
  storageBucket: 'shredly-v5.firebasestorage.app',
  messagingSenderId: '79762267643',
  appId: '1:79762267643:web:2516948dd1fee3e557bf5e',
  measurementId: 'G-LN59J85T88',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export const analytics = getAnalytics(app)
