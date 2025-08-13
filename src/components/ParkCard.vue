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
      <div class="media-gradient" aria-hidden="true"></div>
    </div>

    <!-- status stamp -->
    <div
      v-if="status && status !== 'open'"
      class="status-stamp"
      :class="'status-' + status"
      :aria-label="status === 'construction' ? 'Under construction' : 'Closed'"
    >
      {{ status === 'construction' ? 'Under construction' : 'Closed' }}
    </div>

    <div class="body">
      <div class="title-row">
        <div class="name">
          {{ name }}
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
          <i-material-symbols-straighten-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ Number(size).toLocaleString() }} sqft
        </span>
        <span v-if="builder">
          <i-material-symbols-build-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ builder }}
        </span>
        <span v-if="hours">
          <i-material-symbols-schedule-outline-rounded
            class="icon"
            aria-hidden="true"
          />
          {{ hours }}
        </span>
      </div>

      <div v-if="tags?.length" class="chips">
        <span v-for="t in shortTags" :key="t" class="tag">{{ t }}</span>
        <span v-if="moreTags > 0" class="tag more">+{{ moreTags }}</span>
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
})

const coverUrl = computed(() => {
  if (!cover) return ''
  return (
    cover.md?.webp || cover.md?.jpg || cover.sm?.webp || cover.sm?.jpg || ''
  )
})

const shortTags = computed(() => (tags || []).slice(0, 2))
const moreTags = computed(() => Math.max(0, (tags || []).length - 2))
</script>

<style scoped>
.park-card {
  position: relative;
  padding: 0;
} /* let media/border define shape */
.stretched-link {
  position: absolute;
  inset: 0;
  z-index: 5;
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
}
.name {
  font-family: 'Sedgwick Ave Display', cursive;
  font-size: 18px;
  letter-spacing: 0.2px;
  line-height: 1.1;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon {
  width: 1.1em;
  height: 1.1em;
  vertical-align: -0.18em;
  color: var(--text-2);
}
.icon--visited {
  color: #24d87a;
}

/* --- overlay mode when cover exists --- */
.park-card.has-cover .body {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 6; /* above image & stretched link background */
  padding: 10px 12px 12px;
  /* translucent panel w/ slight blur */
  background: rgba(10, 20, 35, 0.42);
  backdrop-filter: blur(2px);
  /* soft top fade so the panel blends into photo */
  box-shadow: 0 -20px 40px -10px rgba(10, 20, 35, 0.5) inset;
  /* border-top: 1px solid #0b1424aa; */
}
.park-card.has-cover .name {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.park-card.has-cover .meta,
.park-card.has-cover .tag {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

/* tight, wrap-friendly meta row */
.meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-2);
}
.meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* chips: show only a couple to stay compact */
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #10233a;
  border: 1px solid #2b3b5a;
  color: var(--text-2);
  font-weight: 700;
  font-size: 11px;
}
.tag.more {
  opacity: 0.85;
}

/* status stamp stays as you had it */
.status-stamp {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 6;
  font-family: 'Protest Guerrilla', system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 10px;
  border-radius: 8px;
  transform: rotate(6deg);
  font-size: 16px;
  line-height: 1;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(1px);
}
.status-stamp.status-closed {
  color: #ff99b1;
  background: rgba(59, 17, 29, 0.45);
  border: 2px solid #6b1a2a;
}
.status-stamp.status-construction {
  color: #ffef9a;
  background: rgba(44, 42, 20, 0.45);
  border: 2px solid #5a5520;
}

/* slightly denser on small screens */
@media (max-width: 480px) {
  .body {
    padding: 8px 10px;
    gap: 5px;
  }
  .name {
    font-size: 17px;
  }
  .meta {
    font-size: 11.5px;
    gap: 8px;
  }
}

/* a subtle fade from bottom upward to help text legibility */
.media-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(6, 12, 22, 0.72) 0%,
    rgba(6, 12, 22, 0.42) 45%,
    rgba(6, 12, 22, 0) 70%
  );
  pointer-events: none;
}
</style>
