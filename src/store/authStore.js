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

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAdmin: false,
    loading: true,
    profile: null, // { displayName, photoURL, visitedCount, photoCount, joinedAt }
  }),
  getters: {
    displayName: (s) => s.profile?.displayName || s.user?.displayName || null,
  },
  actions: {
    async init() {
      if (this._inited) return
      this._inited = true
      onAuthStateChanged(auth, async (u) => {
        this.user = u
        if (u) {
          const token = await getIdTokenResult(u, /* forceRefresh */ true)
          this.isAdmin = !!token.claims.admin

          // load (or create) profile doc
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
        } else {
          this.isAdmin = false
          this.profile = null
        }
        this.loading = false
      })
    },
    async login(email, password) {
      await signInWithEmailAndPassword(auth, email, password)
    },
    async signup(email, password, rawDisplayName) {
      const dn = (rawDisplayName || '').trim().replace(/\s+/g, ' ')
      if (dn.length < 2 || dn.length > 30) {
        throw new Error('Display name must be 2–30 characters.')
      }
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
