import { defineStore } from 'pinia'
import { db } from '../lib/firebase'
import {
  collection,
  orderBy,
  query,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore'

export const useParksStore = defineStore('parks', {
  state: () => ({
    query: '',
    parks: [],
    visited: JSON.parse(localStorage.getItem('visitedParks') || '[]'),
    unsub: null,
    _cache: {}, // id -> park
  }),
  getters: {
    visitedSet: (s) => new Set(s.visited),
    byId: (state) => (id) =>
      state._cache[id] || state.parks.find((p) => p.id === id),
    filteredParks: (s) => {
      const q = s.query.trim().toLowerCase()
      if (!q) return s.parks
      return s.parks.filter((p) => {
        const hay = [p.name, p.city, p.state, (p.tags || []).join(' ')]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    },
  },
  actions: {
    setQuery(q) {
      this.query = q
    },
    async loadOne(id) {
      // use cache if parks already loaded
      const cached = this.byId(id)
      if (cached) return cached
      try {
        const snap = await getDoc(doc(db, 'parks', id))
        if (snap.exists()) {
          const p = { id: snap.id, ...snap.data() }
          this._cache[id] = p
          return p
        }
      } catch (e) {
        console.warn('loadOne failed', e)
      }
      return null
    },
    toggleVisited(id) {
      const i = this.visited.indexOf(id)
      if (i >= 0) this.visited.splice(i, 1)
      else this.visited.push(id)
      localStorage.setItem('visitedParks', JSON.stringify(this.visited))
    },
    async start() {
      // Cache-first one-time fetch with TTL; no realtime stream
      if (this.unsub === 'started') return
      this.unsub = 'started'
      try {
        const cached = await loadParksFromCache()
        if (cached?.list?.length) {
          this.parks = cached.list
          this._cache = {}
          for (const p of cached.list) this._cache[p.id] = p
          // TTL: if fresh, skip network fetch for now
          const age = Date.now() - (cached.updatedAt || 0)
          if (age < CACHE_TTL_MS) return
        }
      } catch (e) {
        console.warn('Failed to read parks cache', e)
      }

      await this.refresh()
    },

    async refresh() {
      try {
        const qref = query(collection(db, 'parks'), orderBy('name'))
        const snap = await getDocs(qref)
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        this.parks = list
        this._cache = {}
        for (const p of list) this._cache[p.id] = p
        await saveParksToCache(list).catch(() => {})
      } catch (e) {
        if (!this.parks?.length) {
          console.warn('parks fetch failed; using demo data', e)
          this.useDemo()
        } else {
          console.warn('parks refresh failed (kept cached list)', e)
        }
      }
    },
    useDemo() {
      this.parks = [
        {
          id: 'denver-civic',
          name: 'Civic Center Park',
          city: 'Denver',
          state: 'CO',
          lat: 39.739,
          lng: -104.99,
          sizeSqft: 20000,
          builder: 'Dreamland',
          hours: '7am–10pm',
          tags: ['indoor', 'lights', 'concrete'],
        },
        {
          id: 'sunset-plaza',
          name: 'Sunset Plaza',
          city: 'Fort Collins',
          state: 'CO',
          lat: 40.585,
          lng: -105.084,
          sizeSqft: 9400,
          builder: 'Spohn Ranch',
          hours: '6am–10pm',
          tags: ['street', 'prefab'],
        },
        {
          id: 'ridge-line-bowl',
          name: 'Ridge Line Bowl',
          city: 'Golden',
          state: 'CO',
          lat: 39.755,
          lng: -105.221,
          sizeSqft: 15800,
          builder: 'Grindline',
          hours: '24 hours',
          tags: ['bowl', 'lights', 'concrete'],
        },
      ]
    },
  },
})

// ---- Minimal IndexedDB cache (key-value store) ----
const DB_NAME = 'shredly'
const DB_VERSION = 1
const STORE = 'kv'
const PARKS_KEY = 'parks'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function idbSet(db, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.put(val, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function loadParksFromCache() {
  try {
    const db = await openDB()
    const entry = await idbGet(db, PARKS_KEY)
    if (!entry || !Array.isArray(entry.list)) return null
    return entry
  } catch {
    return null
  }
}

async function saveParksToCache(list) {
  try {
    const db = await openDB()
    const entry = { list, updatedAt: Date.now() }
    await idbSet(db, PARKS_KEY, entry)
  } catch {}
}
