<template>
  <section class="page">
    <div class="hero">
      <div class="title">
        <div class="name">{{ park?.name || 'Skatepark' }}</div>
        <div class="sub">
          {{ [park?.city, park?.state].filter(Boolean).join(', ') }}
        </div>
      </div>
      <div class="actions">
        <button class="btn" @click="toggleVisited">
          {{ visited ? 'Visited ✓' : 'Mark visited' }}
        </button>
        <RouterLink class="btn" to="/map">Map</RouterLink>
        <RouterLink
          v-if="isAdmin"
          class="btn btn-primary"
          :to="`/admin/parks/${id}`"
          >Edit</RouterLink
        >
      </div>
      <div v-if="statusBadge" class="stamp" :class="statusBadge.class">
        {{ statusBadge.text }}
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="section-title">Details</div>
        <ul class="facts">
          <li v-if="park?.sizeSqft">
            📏 {{ Number(park.sizeSqft).toLocaleString() }} sqft
          </li>
          <li v-if="park?.builder">🏗️ {{ park.builder }}</li>
          <li v-if="park?.openedYear">📅 Opened {{ park.openedYear }}</li>
          <li v-if="park?.hours">🕒 {{ park.hours }}</li>
          <li v-if="park?.address">📍 {{ park.address }}</li>
        </ul>
        <div class="chips" v-if="park?.tags?.length">
          <span class="tag" v-for="t in park.tags" :key="t">{{ t }}</span>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Add a photo</div>
        <div class="uploader">
          <input
            id="fileInput"
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            @change="onFiles"
          />
          <label for="fileInput" class="btn btn-primary">{{
            uploading ? 'Uploading…' : 'Choose photos'
          }}</label>
          <div class="hint">
            JPEG/PNG/WEBP/HEIC supported. Up to ~20MB each.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Photos</div>
        <div class="photos" v-if="photos.length">
          <div class="photo-tile" v-for="p in photos" :key="p.id">
            <!-- Local preview only for browser-supported formats -->
            <img v-if="localPreview[p.id]" :src="localPreview[p.id]" alt="" />

            <img
              v-else-if="p.status === 'ready'"
              :src="bestSrc(p)"
              :srcset="srcSet(p)"
              sizes="(max-width: 600px) 50vw, 33vw"
              loading="lazy"
              decoding="async"
              alt=""
            />

            <!-- photo credit -->
            <RouterLink
              v-if="p.userId"
              class="credit"
              :to="{ name: 'profile', params: { uid: p.userId } }"
            >
              {{ p.userDisplayName || 'User' }}
            </RouterLink>

            <div v-if="p.status !== 'ready'" class="ph processing">
              <div class="label">
                {{
                  localPreview[p.id]
                    ? `Uploading ${uploadProgress[p.id] ?? 0}%`
                    : p.status === 'failed'
                    ? 'Failed to process'
                    : 'Processing…'
                }}
              </div>
              <div v-if="uploadProgress[p.id] != null" class="progress">
                <div
                  class="bar"
                  :style="{ width: (uploadProgress[p.id] || 0) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="muted">No photos yet.</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { ref as sRef, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { useRoute } from 'vue-router'
import { useParksStore } from '../store/parksStore'
import { useAuthStore } from '../store/authStore' // assuming you have this

const route = useRoute()
const store = useParksStore()
const auth = useAuthStore()

const id = route.params.id
const park = ref(null)
const photos = ref([])
const uploading = ref(false)

onMounted(async () => {
  park.value = await store.loadOne(String(id))
  // live stream of this park's photos (newest first)
  const q = query(
    collection(db, 'photos'),
    where('parkId', '==', String(id)),
    orderBy('createdAt', 'desc')
  )
  onSnapshot(q, (snap) => {
    photos.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  })
})

const visited = computed(() => store.visitedSet.has(String(id)))
function toggleVisited() {
  store.toggleVisited(String(id))
}

const isAdmin = computed(() => !!auth?.isAdmin)

// const photos = computed(() => (park.value?.photos || []).slice(0, 24))

const statusBadge = computed(() => {
  const s = (park.value?.status || 'open').toLowerCase()
  if (s === 'closed') return { class: 'closed', text: 'Closed' }
  if (s === 'construction')
    return { class: 'construction', text: 'Under construction' }
  return null
})

async function onFiles(e) {
  const files = Array.from(e.target.files || [])
  if (!auth?.user) {
    alert('Please sign in to upload photos')
    return
  }
  if (!files.length) return
  uploading.value = true
  try {
    await Promise.all(files.map((f) => uploadOne(f)))
  } finally {
    uploading.value = false
    e.target.value = '' // reset input
  }
}

// local preview + progress while the file is uploading
const localPreview = ref({}) // { [photoId]: objectURL }
const uploadProgress = ref({}) // { [photoId]: percent }

function canPreviewInBrowser(file) {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  if (type.includes('heic') || type.includes('heif')) return false
  if (!type && (name.endsWith('.heic') || name.endsWith('.heif'))) return false
  return type ? type.startsWith('image/') : true
}

async function uploadOne(file) {
  const userId = auth.user.uid
  const userDisplayName =
    auth.user.displayName ||
    auth.profile?.displayName || // if you keep one in Firestore
    (auth.user.email ? auth.user.email.split('@')[0] : 'User')

  const parkId = String(id)
  // create Firestore record first
  const docRef = await addDoc(collection(db, 'photos'), {
    userId,
    parkId,
    userDisplayName,
    status: 'uploading',
    createdAt: serverTimestamp(),
  })

  // local preview for formats the browser can display (NOT HEIC)
  if (canPreviewInBrowser(file)) {
    const url = URL.createObjectURL(file)
    localPreview.value = { ...localPreview.value, [docRef.id]: url } // reassign for reactivity
  }

  // upload original with metadata (Function reads these)
  const path = `uploads/${userId}/${docRef.id}/original`
  const meta = {
    contentType: file.type || 'application/octet-stream',
    customMetadata: { parkId, userId, photoId: docRef.id },
  }
  const task = uploadBytesResumable(sRef(storage, path), file, meta)
  // optional: listen to progress (you can surface a per-file progress bar)
  task.on(
    'state_changed',
    (snap) => {
      const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
      uploadProgress.value = { ...uploadProgress.value, [docRef.id]: pct } // reassign
    },
    (err) => {
      console.error(err)
    },
    () => {
      /* upload complete → Cloud Function takes over (processing) */
    }
  )
}

function bestSrc(p) {
  // prefer md.webp, then md.jpg, then sm.webp/jpg
  return (
    p.outputs?.md?.webp ||
    p.outputs?.md?.jpg ||
    p.outputs?.sm?.webp ||
    p.outputs?.sm?.jpg ||
    ''
  )
}
function srcSet(p) {
  const o = p.outputs || {}
  const parts = []
  if (o.sm?.webp) parts.push(`${o.sm.webp} 512w`)
  if (o.md?.webp) parts.push(`${o.md.webp} 1024w`)
  if (o.lg?.webp) parts.push(`${o.lg.webp} 1600w`)
  if (!parts.length) {
    if (o.sm?.jpg) parts.push(`${o.sm.jpg} 512w`)
    if (o.md?.jpg) parts.push(`${o.md.jpg} 1024w`)
    if (o.lg?.jpg) parts.push(`${o.lg.jpg} 1600w`)
  }
  return parts.join(', ')
}

// when Firestore flips a photo to "ready", drop the temp preview & progress
watch(photos, (list) => {
  for (const p of list) {
    if (p.status === 'ready' && localPreview.value[p.id]) {
      const lp = { ...localPreview.value }
      try {
        URL.revokeObjectURL(lp[p.id])
      } catch {}
      delete lp[p.id]
      localPreview.value = lp
      const up = { ...uploadProgress.value }
      delete up[p.id]
      uploadProgress.value = up
    }
  }
})
</script>

<style scoped>
.page {
  display: grid;
  gap: 16px;
}
.hero {
  position: relative;
  border: 1px solid var(--outline);
  border-radius: var(--radius);
  padding: 14px;
  background: linear-gradient(180deg, #0f1b2d, #0e1726);
}
.title .name {
  font-family: 'Sedgwick Ave Display', cursive;
  font-size: 28px;
}
.title .sub {
  color: var(--text-2);
  font-size: 13px;
}
.actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.stamp {
  position: absolute;
  top: 12px;
  right: 12px;
  font-family: 'Protest Guerrilla', system-ui, sans-serif;
  text-transform: uppercase;
  padding: 6px 10px;
  border-radius: 8px;
  transform: rotate(-8deg);
  font-size: 18px;
  line-height: 1;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.stamp.closed {
  color: #ff99b1;
  background: rgba(59, 17, 29, 0.45);
  border: 2px solid #6b1a2a;
}
.stamp.construction {
  color: #ffef9a;
  background: rgba(44, 42, 20, 0.45);
  border: 2px solid #5a5520;
}

.photos {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.photos.small img,
.photos img {
  width: 100%;
  aspect-ratio: 1/1;
  object-fit: cover;
  border-radius: 8px;
}

.grid2 {
  display: grid;
  gap: 16px;
}
@media (min-width: 800px) {
  .grid2 {
    grid-template-columns: 1fr 1fr;
  }
}

.facts {
  list-style: none;
  padding: 0;
  margin: 6px 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: var(--text-2);
  font-size: 13px;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.uploader {
  display: flex;
  align-items: center;
  gap: 12px;
}
.uploader input[type='file'] {
  display: none;
}
.uploader .hint {
  color: var(--text-2);
  font-size: 12px;
}

.photos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
@media (max-width: 700px) {
  .photos {
    grid-template-columns: repeat(2, 1fr);
  }
}

.photo-tile {
  position: relative;
  width: 100%;
  aspect-ratio: 1/1;
  border-radius: 8px;
  overflow: hidden;
  background: #0e1726;
  border: 1px solid var(--outline);
}
.photo-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* pink credit overlay */
.photo-tile .credit {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--accent); /* bright pink */
  font-weight: 800;
  font-size: 12px;
  text-decoration: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  background: rgba(10, 20, 35, 0.28); /* subtle for legibility */
  backdrop-filter: blur(2px);
  border: 1px solid #2b3b5a;
}
.photo-tile .credit:hover {
  transform: translateY(-1px);
}

.ph.processing {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #ffd5e9;
  background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.04),
      rgba(255, 255, 255, 0.02) 20%,
      rgba(255, 255, 255, 0.04) 40%
    )
    no-repeat;
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
  position: relative;
  flex-direction: column;
  gap: 8px;
}

.ph.processing .label {
  z-index: 1;
}
.ph.processing .progress {
  width: 90%;
  height: 6px;
  border: 1px solid #2b3b5a;
  background: #162541;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 8px;
}
.ph.processing .progress .bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(180deg, var(--accent-2), var(--accent));
  transition: width 0.15s ease;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
