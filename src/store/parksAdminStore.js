import { defineStore } from 'pinia'
import { db } from '../lib/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

function slugify(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80)
}

export const useAdminParksStore = defineStore('parksAdmin', {
  state: () => ({
    parks: [],
    unsub: null,
  }),
  actions: {
    subscribe() {
      if (this.unsub) return
      const qref = query(collection(db, 'parks'), orderBy('name'))
      this.unsub = onSnapshot(qref, (snap) => {
        this.parks = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      })
    },
    async getPark(id) {
      const snap = await getDoc(doc(db, 'parks', id))
      return snap.exists() ? { id: snap.id, ...snap.data() } : null
    },
    async createPark(data) {
      // prefer slug id if unique; else use auto id
      const id = slugify(data.name || '') || undefined
      const ref = id ? doc(db, 'parks', id) : doc(collection(db, 'parks'))
      const payload = {
        name: data.name || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        lat: Number(data.lat),
        lng: Number(data.lng),
        sizeSqft: data.sizeSqft != null ? Number(data.sizeSqft) : null,
        builder: data.builder || '',
        openedYear: data.openedYear != null ? Number(data.openedYear) : null,
        hours: data.hours || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(ref, payload)
      return ref.id
    },
    async updatePark(id, data) {
      const ref = doc(db, 'parks', id)
      const payload = {
        name: data.name || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        lat: Number(data.lat),
        lng: Number(data.lng),
        sizeSqft: data.sizeSqft != null ? Number(data.sizeSqft) : null,
        builder: data.builder || '',
        openedYear: data.openedYear != null ? Number(data.openedYear) : null,
        hours: data.hours || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        updatedAt: serverTimestamp(),
      }
      await updateDoc(ref, payload)
    },
    async deletePark(id) {
      await deleteDoc(doc(db, 'parks', id))
    },
  },
})
