import { defineStore } from 'pinia'
import { auth, db } from '../lib/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getIdTokenResult,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useVisitedStore } from './visitedStore'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAdmin: false,
    loading: true,
    profile: null,
  }),
  getters: {
    displayName: (s) => s.profile?.displayName || s.user?.displayName || null,
  },
  actions: {
    async init() {
      if (this._inited) return
      this._inited = true

      const visited = useVisitedStore()

      onAuthStateChanged(auth, async (u) => {
        this.user = u
        if (u) {
          const token = await getIdTokenResult(u, /* forceRefresh */ true)
          this.isAdmin = !!token.claims.admin
          const ref = doc(db, 'users', u.uid)
          const snap = await getDoc(ref)
          if (!snap.exists()) {
            const base = {
              displayName: u.displayName || '',
              photoURL: u.photoURL || '',
              visitedCount: 0,
              photoCount: 0,
              joinedAt: serverTimestamp(),
            }
            await setDoc(ref, base, { merge: true })
            this.profile = base
          } else {
            this.profile = snap.data()
          }
          visited.start()
        } else {
          this.isAdmin = false
          this.profile = null
          visited.stop()
        }
        this.loading = false
      })
    },
    async login(email, password) {
      await signInWithEmailAndPassword(auth, email, password)
    },
    async signup(email, password, rawDisplayName) {
      const dn = (rawDisplayName || '').trim().replace(/\s+/g, ' ')
      if (dn.length < 2 || dn.length > 30)
        throw new Error('Display name must be 2–30 characters.')
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: dn })
      const ref = doc(db, 'users', cred.user.uid)
      await setDoc(
        ref,
        {
          displayName: dn,
          photoURL: '',
          visitedCount: 0,
          photoCount: 0,
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      )
    },
    async logout() {
      await signOut(auth)
    },
  },
})
