<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  photos: { type: Array, default: () => [] }, // array of photo docs
  startIndex: { type: Number, default: 0 },
  localPreview: { type: Object, default: () => ({}) }, // { [photoId]: objectURL }
})
const emit = defineEmits(['update:show'])

const idx = ref(0)
const open = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v),
})

watch(
  () => props.show,
  (v) => {
    if (!v) return
    idx.value = clamp(props.startIndex, 0, props.photos.length - 1)
    lockScroll(true)
    nextTick(() => preloadNeighbors())
  }
)

watch(
  () => props.startIndex,
  (v) => {
    if (!open.value) return
    idx.value = clamp(v, 0, props.photos.length - 1)
  }
)

onBeforeUnmount(() => lockScroll(false))

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n))
}
function close() {
  open.value = false
  lockScroll(false)
}
function next() {
  if (idx.value < props.photos.length - 1) {
    idx.value++
    preloadNeighbors()
  }
}
function prev() {
  if (idx.value > 0) {
    idx.value--
    preloadNeighbors()
  }
}

function bestLargeSrc(p) {
  // prefer largest processed, or fall back to md/sm, or local preview while uploading
  const o = p.outputs || {}
  return (
    o.lg?.webp ||
    o.lg?.jpg ||
    o.md?.webp ||
    o.md?.jpg ||
    o.sm?.webp ||
    o.sm?.jpg ||
    props.localPreview[p.id] ||
    ''
  )
}

function preloadNeighbors() {
  const pre = [idx.value + 1, idx.value - 1].filter(
    (i) => i >= 0 && i < props.photos.length
  )
  pre.forEach((i) => {
    const p = props.photos[i]
    const url = bestLargeSrc(p)
    if (url) {
      const img = new Image()
      img.src = url
    }
  })
}

function onKey(e) {
  if (!open.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// simple swipe
let touchX = null
function onTouchStart(e) {
  touchX = e.touches?.[0]?.clientX ?? null
}
function onTouchEnd(e) {
  if (touchX == null) return
  const dx = (e.changedTouches?.[0]?.clientX ?? touchX) - touchX
  if (Math.abs(dx) > 40) (dx < 0 ? next : prev)()
  touchX = null
}

function lockScroll(lock) {
  document?.body && (document.body.style.overflow = lock ? 'hidden' : '')
}
</script>

<template>
  <teleport to="body">
    <div
      v-if="open"
      class="lb"
      @click.self="close"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <button class="lb-btn lb-close" @click="close" aria-label="Close">
        <i-material-symbols-close-rounded class="ico" />
      </button>

      <button
        class="lb-btn lb-prev"
        :disabled="idx === 0"
        @click.stop="prev"
        aria-label="Previous photo"
      >
        <i-material-symbols-chevron-left-rounded class="ico" />
      </button>

      <button
        class="lb-btn lb-next"
        :disabled="idx === photos.length - 1"
        @click.stop="next"
        aria-label="Next photo"
      >
        <i-material-symbols-chevron-right-rounded class="ico" />
      </button>

      <figure class="lb-fig">
        <img
          v-if="photos[idx]"
          class="lb-img"
          :src="bestLargeSrc(photos[idx])"
          alt=""
          decoding="async"
          loading="eager"
        />
        <figcaption class="lb-cap" v-if="photos[idx]">
          <span class="dim">{{ idx + 1 }} / {{ photos.length }}</span>
          <span class="spacer"></span>
          <RouterLink
            v-if="photos[idx].userId"
            :to="{ name: 'profile', params: { uid: photos[idx].userId } }"
            class="credit"
            >{{ photos[idx].userDisplayName || 'User' }}</RouterLink
          >
        </figcaption>
      </figure>
    </div>
  </teleport>
</template>

<style scoped>
.lb {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(5, 10, 18, 0.86);
  display: grid;
  place-items: center;
  padding: 18px;
}
.lb-fig {
  max-width: min(96vw, 1200px);
  max-height: 88vh;
  width: 100%;
  margin: 0;
}
.lb-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
  background: #0e1726;
}
.lb-cap {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #c7d2ee;
  margin-top: 8px;
}
.lb-cap .spacer {
  flex: 1;
}
.credit {
  color: var(--accent);
  text-decoration: none;
  font-weight: 800;
  background: rgba(10, 20, 35, 0.28);
  border: 1px solid var(--outline);
  padding: 3px 8px;
  border-radius: 8px;
}

/* controls */
.lb-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(10, 20, 35, 0.6);
  border: 1px solid var(--outline);
  color: #e7edff;
  cursor: pointer;
}
.lb-btn:hover {
  filter: brightness(1.06);
}
.lb-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.lb-prev {
  left: 12px;
}
.lb-next {
  right: 12px;
}
.lb-close {
  top: 12px;
  right: 12px;
  transform: none;
  width: 38px;
  height: 38px;
}

/* icons */
.ico {
  width: 22px;
  height: 22px;
}

/* small screens */
@media (max-width: 480px) {
  .lb {
    padding: 10px;
  }
  .lb-prev {
    left: 6px;
  }
  .lb-next {
    right: 6px;
  }
  .lb-btn {
    width: 38px;
    height: 38px;
  }
}
</style>
