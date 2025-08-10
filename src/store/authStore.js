import { defineStore } from 'pinia'
import { auth } from '../lib/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getIdTokenResult,
} from 'firebase/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAdmin: false,
    loading: true,
  }),
  actions: {
    async init() {
      if (this._inited) return
      this._inited = true
      onAuthStateChanged(auth, async (u) => {
        this.user = u
        if (u) {
          const token = await getIdTokenResult(u, /* forceRefresh */ true)
          this.isAdmin = !!token.claims.admin
        } else {
          this.isAdmin = false
        }
        this.loading = false
      })
    },
    async login(email, password) {
      await signInWithEmailAndPassword(auth, email, password)
    },
    async signup(email, password) {
      await createUserWithEmailAndPassword(auth, email, password)
    },
    async logout() {
      await signOut(auth)
    },
  },
})
