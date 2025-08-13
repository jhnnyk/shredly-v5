<template>
  <section class="page">
    <!-- hero (full-bleed) -->
    <div class="hero" :class="{ 'has-image': !!heroUrl }">
      <img v-if="heroUrl" class="hero-img" :src="heroUrl" alt="" />
      <div class="hero-grad" aria-hidden="true"></div>

      <div class="hero-overlay">
        <h1 class="hero-name">{{ park?.name || 'Skatepark' }}</h1>
        <p class="tagline">
          <i-material-symbols-location-on-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ [park?.city, park?.state].filter(Boolean).join(', ') }}
        </p>
      </div>

      <!-- status stamp -->
      <div v-if="statusBadge" class="stamp" :class="statusBadge.class">
        {{ statusBadge.text }}
      </div>
    </div>

    <!-- keep actions BELOW the hero for a cleaner overlay -->
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

    <div class="grid2">
      <div class="card p-12">
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

      <div class="card p-12">
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

      <div class="card p-16">
        <div class="section-title">Photos</div>
        <PhotoGrid
          v-if="photos.length"
          :photos="photos"
          :localPreview="localPreview"
          :uploadProgress="uploadProgress"
          :showCredit="true"
          credit-type="user"
        />
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
import { useAuthStore } from '../store/authStore'
import { useVisitedStore } from '../store/visitedStore'
import PhotoGrid from '../components/PhotoGrid.vue'

const route = useRoute()
const store = useParksStore()
const auth = useAuthStore()
const vstore = useVisitedStore()

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

const heroUrl = computed(() => {
  const c = park.value?.cover
  const cover =
    c?.lg?.webp ||
    c?.lg?.jpg ||
    c?.md?.webp ||
    c?.md?.jpg ||
    c?.sm?.webp ||
    c?.sm?.jpg
  if (cover) return cover

  // fallback to the most recent ready photo
  const ready = photos.value.find((p) => p.status === 'ready')
  return (
    ready?.outputs?.lg?.webp ||
    ready?.outputs?.lg?.jpg ||
    ready?.outputs?.md?.webp ||
    ready?.outputs?.md?.jpg ||
    ready?.outputs?.sm?.webp ||
    ready?.outputs?.sm?.jpg ||
    ''
  )
})

const visited = computed(() => vstore.isVisited(String(id)))
function toggleVisited() {
  vstore.toggle(String(id))
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
  gap: 12px;
}

.hero {
  position: relative;

  /* make it full-width even inside a centered .page container */
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);

  margin-top: -16px;

  height: clamp(140px, 30vh, 220px);
  background: linear-gradient(
    180deg,
    #0f1b2d,
    #0e1726
  ); /* fallback when no image */
  border-bottom: 1px solid var(--outline);
  overflow: hidden;
}
.hero.has-image {
  border-bottom-color: transparent;
}

.hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: translateZ(0); /* better scrolling perf on iOS */
}

/* top-to-bottom gradient for text legibility on busy photos */
.hero-grad {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
      to top,
      rgba(6, 12, 22, 0.78) 0%,
      rgba(6, 12, 22, 0.48) 40%,
      rgba(6, 12, 22, 0) 70%
    ),
    linear-gradient(to bottom, rgba(6, 12, 22, 0.2), rgba(6, 12, 22, 0) 40%);
}

/* the translucent bottom overlay panel */
.hero-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 14px 16px 18px;
  background: rgba(10, 20, 35, 0.42);
  backdrop-filter: blur(2px);
  box-shadow: 0 -24px 48px -16px rgba(10, 20, 35, 0.55) inset;
}

.hero-name {
  margin: 0;
  font-family: 'Sedgwick Ave Display', cursive;
  font-size: clamp(22px, 5.2vw, 34px);
  letter-spacing: 0.2px;
  line-height: 1.05;
  color: var(--text);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}

.tagline {
  margin: 0.25rem 0 0;
  color: var(--text-2);
  font-size: clamp(12px, 3.4vw, 14px);
  display: flex;
  align-items: center;
  gap: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 4px; /* aligns with your content nicely */
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
  z-index: 3;
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

@media (max-width: 700px) {
  .photos {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
