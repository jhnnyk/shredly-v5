<!-- src/components/PhotoGrid.vue -->
<script setup>
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { RouterLink } from 'vue-router'

const auth = useAuthStore()
const props = defineProps({
  photos: { type: Array, default: () => [] },

  // Optional: live upload preview/progress (Park detail uses these)
  localPreview: { type: Object, default: () => ({}) }, // { [photoId]: objectURL }
  uploadProgress: { type: Object, default: () => ({}) }, // { [photoId]: percent }

  // Credit overlay
  showCredit: { type: Boolean, default: false },
  creditType: { type: String, default: 'user' }, // 'user' | 'park'
})
const emit = defineEmits(['open'])

function bestSrc(p) {
  return (
    p?.outputs?.md?.webp ||
    p?.outputs?.md?.jpg ||
    p?.outputs?.sm?.webp ||
    p?.outputs?.sm?.jpg ||
    ''
  )
}
function srcSet(p) {
  const o = p?.outputs || {}
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

function canDelete(p) {
  return auth?.isAdmin || (auth?.user && p.userId === auth.user.uid)
}

async function removePhoto(id) {
  if (!confirm('Delete this photo? This cannot be undone.')) return
  try {
    await deleteDoc(doc(db, 'photos', id))
    // onSnapshot stream will drop it from UI automatically
  } catch (e) {
    console.error(e)
    alert('Could not delete photo.')
  }
}

/** Open lightbox from a tile click, but only for ready images */
function openFromGrid(p) {
  if (!p || p.status !== 'ready' || !bestSrc(p)) return
  emit('open', p.id) // parent already expects id; your openLB maps id -> index
}
</script>

<template>
  <div class="photos">
    <!-- Make each tile clickable as a whole so it’s easy to stop propagation from children -->
    <div
      class="photo-tile"
      v-for="(p, i) in photos"
      :key="p.id"
      role="button"
      tabindex="0"
      @click="openFromGrid(p)"
      @keydown.enter.prevent="openFromGrid(p)"
    >
      <!-- local preview (e.g. JPEG/PNG/WebP) -->
      <img v-if="localPreview[p.id]" :src="localPreview[p.id]" alt="" />

      <!-- final image -->
      <img
        v-else-if="p.status === 'ready' && bestSrc(p)"
        :src="bestSrc(p)"
        :srcset="srcSet(p)"
        sizes="(max-width: 700px) 50vw, 33vw"
        loading="lazy"
        decoding="async"
        alt=""
      />

      <!-- processing / upload (remains visible) -->
      <div v-if="(p.status || 'uploading') !== 'ready'" class="ph processing">
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

      <!-- credit overlay (don’t open lightbox) -->
      <RouterLink
        v-if="showCredit && creditType === 'user' && p.userId"
        class="credit"
        :to="{ name: 'profile', params: { uid: p.userId } }"
        @click.stop
      >
        {{ p.userDisplayName || 'User' }}
      </RouterLink>

      <RouterLink
        v-else-if="showCredit && creditType === 'park' && p.parkId"
        class="credit"
        :to="{ name: 'park', params: { id: p.parkId } }"
        @click.stop
      >
        View park
      </RouterLink>

      <!-- delete (don’t open lightbox) -->
      <button
        v-if="canDelete(p)"
        class="tiny danger"
        type="button"
        title="Delete photo"
        @click.stop.prevent="removePhoto(p.id)"
        @keydown.stop
      >
        <i-material-symbols-delete-outline-rounded
          class="icon"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Same compact grid used on Park detail */
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
  cursor: pointer;
  /* Ensure overlay buttons click cleanly even over the image */
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
  color: var(--accent);
  font-weight: 800;
  font-size: 12px;
  text-decoration: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  background: rgba(10, 20, 35, 0.28);
  backdrop-filter: blur(2px);
  border: 1px solid #2b3b5a;
}
.photo-tile .credit:hover {
  transform: translateY(-1px);
}

/* processing / upload UI */
.ph.processing {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
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
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
.ph.processing .progress {
  width: 90%;
  height: 6px;
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid #2b3b5a;
  background: #162541;
  border-radius: 999px;
}
.ph.processing .progress .bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(180deg, var(--accent-2), var(--accent));
  transition: width 0.15s ease;
}

/* delete button overlay */
.tiny.danger {
  position: absolute;
  top: 6px;
  right: 6px;
  background: transparent;
  border: none;
  padding: 0;
}
.tiny.danger .icon {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 8px;
  background: #3a1420;
  border: 1px solid #6b1a2a;
  color: #ff99b1;
  cursor: pointer;
}
.tiny.danger:hover {
  filter: brightness(1.05);
}
</style>
