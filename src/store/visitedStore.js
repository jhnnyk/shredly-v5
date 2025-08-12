// src/store/visitedStore.js
import { defineStore } from 'pinia'
import { db } from '../lib/firebase'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { useAuthStore } from './authStore'

export const useVisitedStore = defineStore('visited', {
  state: () => ({ set: new Set(), _unsub: null }),
  getters: { isVisited: (s) => (id) => s.set.has(String(id)) },
  actions: {
    start() {
      const auth = useAuthStore()
      if (!auth.user) return
      this.stop()
      const col = collection(db, 'users', auth.user.uid, 'visited')
      this._unsub = onSnapshot(col, (snap) => {
        const next = new Set()
        snap.forEach((d) => next.add(d.id))
        this.set = next
      })
    },
    stop() {
      this._unsub?.()
      this._unsub = null
      this.set = new Set()
    },
    async toggle(parkId) {
      const auth = useAuthStore()
      if (!auth.user) throw new Error('Sign in required')
      const id = String(parkId)
      const ref = doc(db, 'users', auth.user.uid, 'visited', id)

      if (this.set.has(id)) {
        this.set = new Set([...this.set].filter((x) => x !== id)) // optimistic
        await deleteDoc(ref).catch((err) => {
          console.error('delete visited failed', err)
          this.start() // resync if it failed
        })
      } else {
        this.set = new Set(this.set).add(id)
        await setDoc(ref, { parkId: id, createdAt: serverTimestamp() }).catch(
          (err) => {
            console.error('create visited failed', err)
            this.start()
          }
        )
      }
    },
  },
})
