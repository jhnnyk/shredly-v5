<template>
  <article class="card park-card" :class="{ 'has-cover': !!coverUrl }">
    <!-- whole card is a link when we have an id -->
    <RouterLink
      v-if="id"
      class="stretched-link"
      :to="{ name: 'park', params: { id } }"
      :aria-label="`View details for ${name}`"
    />

    <!-- cover (collapses if missing) -->
    <div v-if="coverUrl" class="card-media">
      <img :src="coverUrl" alt="" loading="lazy" decoding="async" />
      <!-- optional top fade for readability on busy photos -->
      <div class="img-gradient-top" aria-hidden="true"></div>
    </div>

    <!-- status stamp -->
    <div
      v-if="status && status !== 'open'"
      class="status-badge"
      :class="'is-' + status"
      :aria-label="status === 'construction' ? 'Under construction' : 'Closed'"
    >
      {{ status === 'construction' ? 'Under construction' : 'Closed' }}
    </div>

    <div class="body" :class="{ 'overlay-panel': !!coverUrl }">
      <div class="title-row">
        <div class="title-left">
          <div class="name">
            {{ name }}
          </div>
          <span v-if="isNum(distanceKm)" class="distance">
            {{ distanceLabel }}
          </span>
        </div>
        <i-material-symbols-check-circle-outline-rounded
          v-if="visited"
          class="icon icon--visited"
          aria-label="Visited"
        />
      </div>

      <div class="meta">
        <span v-if="cityState">
          <i-material-symbols-location-on-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ cityState }}
        </span>

        <span v-if="size">
          <i-material-symbols-square-foot class="icon" aria-hidden="true" />
          {{ Number(size).toLocaleString() }} sqft
        </span>

        <span v-if="isNum(visitorsCount)">
          <i-material-symbols-group-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ Number(visitorsCount).toLocaleString() }}
        </span>

        <span v-if="isNum(photosCount)">
          <i-material-symbols-photo-camera-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ Number(photosCount).toLocaleString() }}
        </span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const {
  id,
  name,
  cityState,
  size,
  builder,
  hours,
  tags = [],
  visited = false,
  status = 'open',
  cover = null,
  visitorsCount = undefined,
  photosCount = undefined,
  distanceKm = undefined,
} = defineProps({
  id: { type: String, required: false },
  name: String,
  cityState: String,
  size: [Number, String],
  builder: String,
  hours: String,
  tags: { type: Array, default: () => [] },
  visited: Boolean,
  status: { type: String, default: 'open' },
  cover: { type: Object, default: null }, // { sm:{webp,jpg}, md:{...}, lg:{...} }
  visitorsCount: [Number, String],
  photosCount: [Number, String],
  distanceKm: [Number, String],
})

const coverUrl = computed(() => {
  if (!cover) return ''
  return (
    cover.md?.webp || cover.md?.jpg || cover.sm?.webp || cover.sm?.jpg || ''
  )
})

const isNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n)
}
const distanceLabel = computed(() => {
  if (!isNum(distanceKm)) return ''
  const mi = Number(distanceKm) * 0.621371
  const val = mi < 10 ? mi.toFixed(1) : Math.round(mi).toString()
  return `${val} mi`
})
</script>

<style scoped>
.park-card {
  position: relative;
  padding: 0;
}

/* let media/border define shape */
.stretched-link {
  position: absolute;
  inset: 0;
  z-index: 7;
}

.card-media {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-bottom: 1px solid var(--outline);
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* compact body */
.body {
  padding: 10px 12px;
  display: grid;
  gap: 6px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  min-width: 0;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0; /* required for ellipsis */
  overflow: hidden;
  white-space: nowrap;
}

.name {
  font-family: 'Sedgwick Ave Display', cursive;
  font-size: 20px;
  line-height: 1.1;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  letter-spacing: 1px;
}

.distance {
  font-family: 'Karla', system-ui, -apple-system, Segoe UI, Roboto, Helvetica,
    Arial;
  color: var(--accent);
  font-weight: bold;
  font-size: 16px;
  flex: 0 0 auto;
  white-space: nowrap;
}

.icon--visited {
  color: #24d87a;
  flex: 0 0 auto;
}

/* --- overlay mode when cover exists --- */
.park-card.has-cover .body {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 6; /* above image & stretched link background */
  padding: 10px 12px 12px;
}
.park-card.has-cover .name {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.park-card.has-cover .meta {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

/* gradient moved to global .img-gradient-top */
</style>
