<template>
  <section class="page">
    <!-- hero (full-bleed) -->
    <div class="hero" :class="{ 'has-image': !!heroUrl }">
      <img v-if="heroUrl" class="hero-img" :src="heroUrl" alt="" />
      <div class="img-gradient-top" aria-hidden="true"></div>

      <div class="hero-overlay overlay-panel">
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
      <div v-if="statusBadge" class="status-badge" :class="statusBadge.class">
        {{ statusBadge.text }}
      </div>
    </div>

    <div class="card p-12">
      <ul class="facts">
        <li>
          <i-material-symbols-group-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ park?.visitorsCount || 0 }}
        </li>

        <li>
          <i-material-symbols-photo-camera-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ park?.photosCount || 0 }}
        </li>

        <li v-if="park?.hours">
          <i-material-symbols-schedule-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ park.hours }}
        </li>
      </ul>
      <div class="actions">
        <button class="btn" @click="onMarkVisited">
          {{ visited ? 'Visited ✓' : 'Mark visited' }}
        </button>

        <div class="uploader">
          <input
            ref="fileInputRef"
            id="fileInput"
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            @change="onFiles"
          />
          <label
            for="fileInput"
            class="btn btn-primary"
            @click.prevent="onChoosePhotosClick"
          >
            {{ uploading ? 'Uploading…' : 'Add Photo' }}
          </label>
          <p class="hint">JPEG/PNG/WEBP/HEIC supported. Up to ~20MB each.</p>
        </div>

        <RouterLink
          v-if="isAdmin"
          class="btn btn-primary"
          :to="`/admin/parks/${id}`"
          >Edit</RouterLink
        >
      </div>
      
    </div>

    <div class="details">
      <div class="location">
        <h3>Location</h3>
        <p class="address" v-if="park?.address">
          {{ park.address }}<br />
          <span v-if="park?.city"> {{ park.city }},&nbsp; </span>
          <span v-if="park?.state"> {{ park.state }}&nbsp; </span>
          <span v-if="park?.zip">{{ park.zip }}</span
          ><br />

          <span v-if="park?.lat && park?.lng" class="map-links">
            <a
              :href="`https://www.google.com/maps/search/?api=1&query=${park.lat},${park.lng}`"
              target="_blank"
              rel="noopener"
              class="map-link"
            >
              <i-material-symbols-location-on-outline-rounded
                class="icon"
                aria-hidden="true"
              />
              Google Maps
            </a>
            <a
              :href="`https://maps.apple.com/?ll=${park.lat},${
                park.lng
              }&q=${encodeURIComponent(park.name || 'Skatepark')}`"
              target="_blank"
              rel="noopener"
              class="map-link"
            >
              <i-material-symbols-location-on-outline-rounded
                class="icon"
                aria-hidden="true"
              />
              Apple Maps
            </a>
          </span>
        </p>
      </div>
      <div class="stats">
        <h3>Stats</h3>
        <ul class="facts">
          <li v-if="park?.sizeSqft">
            <i-material-symbols-square-foot class="icon" aria-hidden="true" />
            {{ Number(park.sizeSqft).toLocaleString() }} sqft
          </li>
          <li v-if="park?.builder">
            <i-material-symbols-build-outline-rounded
              class="icon"
              aria-hidden="true"
            />
            {{ park.builder }}
          </li>

          <li v-if="park?.openedYear">
            <i-material-symbols-calendar-month-outline-rounded
              class="icon"
              aria-hidden="true"
            />
            Opened {{ park.openedYear }}
          </li>
        </ul>

        <div class="chips" v-if="park?.tags?.length">
          <span class="tag" v-for="t in park.tags" :key="t">{{ t }}</span>
        </div>
      </div>
    </div>

    <h3>Recent Photos</h3>
    <PhotoGrid
      v-if="photos.length"
      :photos="photos"
      :localPreview="localPreview"
      :uploadProgress="uploadProgress"
      :showCredit="true"
      credit-type="user"
      @open="openLB"
    />

    <div v-else class="muted">No photos yet.</div>

    <!-- Lightbox -->
    <PhotoLightbox
      v-model:show="showLB"
      :photos="viewablePhotos"
      :startIndex="lbIndex"
      :localPreview="localPreview"
    />
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
import { useRoute, useRouter } from 'vue-router'
import { useParksStore } from '../store/parksStore'
import { useAuthStore } from '../store/authStore'
import { useVisitedStore } from '../store/visitedStore'
import PhotoGrid from '../components/PhotoGrid.vue'
import PhotoLightbox from '../components/PhotoLightbox.vue'

const route = useRoute()
const router = useRouter()
const store = useParksStore()
const auth = useAuthStore()
const vstore = useVisitedStore()

const id = route.params.id
const park = ref(null)
const photos = ref([])
const uploading = ref(false)
const showLB = ref(false)
const lbIndex = ref(0)
const fileInputRef = ref(null)

onMounted(async () => {
  park.value = await store.loadOne(String(id))
  // set page title
  if (park.value?.name) {
    document.title = `${park.value.name} – Shredly`
  }
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

const goToAuth = () => {
  router.push('/profile')
}

const visited = computed(() => vstore.isVisited(String(id)))

const onMarkVisited = () => {
  if (!auth.user) return goToAuth()
  vstore.toggle(String(id))
}

const onChoosePhotosClick = (e) => {
  if (!auth.user) return goToAuth()
  fileInputRef.value?.click()
}

const isAdmin = computed(() => !!auth?.isAdmin)

// const photos = computed(() => (park.value?.photos || []).slice(0, 24))

const statusBadge = computed(() => {
  const s = (park.value?.status || 'open').toLowerCase()
  if (s === 'closed') return { class: 'is-closed', text: 'Closed' }
  if (s === 'construction')
    return { class: 'is-construction', text: 'Under construction' }
  return null
})

async function onFiles(e) {
  const files = Array.from(e.target.files || [])
  if (!auth?.user) {
    goToAuth()
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

const viewablePhotos = computed(() =>
  photos.value.filter((p) => p.status === 'ready' || !!localPreview.value[p.id])
)
function openLB(idOrIndex) {
  const list = viewablePhotos.value
  const i =
    typeof idOrIndex === 'number'
      ? idOrIndex
      : list.findIndex((p) => p.id === idOrIndex)
  lbIndex.value = i >= 0 ? i : 0
  showLB.value = true
}
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

/* gradient moved to global .img-gradient-top */

/* the translucent bottom overlay panel */
.hero-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 14px 16px 18px;
}

.hero-name {
  margin: 0;
  font-family: 'Sedgwick Ave Display', cursive;
  font-size: clamp(22px, 5.2vw, 34px);
  letter-spacing: 1px;
  line-height: 1.05;
  color: var(--text);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}

.tagline {
  margin: 0.25rem 0 0;
  font-size: clamp(12px, 3.4vw, 14px);
  display: flex;
  align-items: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.facts {
  list-style: none;
  padding: 0;
  margin: 6px 0;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  flex-wrap: wrap;
  font-size: 13px;
}

.details {
  display: flex;
  flex-wrap: wrap;
  row-gap: 20px;
}

.location,
.stats {
  flex: 1;
  min-width: 220px;
}

.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 4px; /* aligns with your content nicely */
  align-items: flex-start; /* keep natural button height */
}

.actions button,
.actions .uploader,
.actions a {
  flex: 1;
  width: 100%;
}
/* full width, natural height */
.actions .btn { width: 100%; }

.uploader {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.uploader input[type='file'] {
  display: none;
}

.uploader .hint {
  font-size: 12px;
  margin: 0;
}

.actions button.btn,
.actions a.btn,
.actions label.btn {
  height: auto;
}

/* upload hint now lives inside .uploader */

/* photos grid handled by PhotoGrid.vue */
</style>
