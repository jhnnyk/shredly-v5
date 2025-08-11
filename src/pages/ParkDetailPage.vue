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

    <div class="photos" v-if="photos.length">
      <img v-for="(src, i) in photos" :key="i" :src="src" alt="" />
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
        <div class="section-title">Photos</div>
        <div class="photos small" v-if="photos.length">
          <img v-for="(src, i) in photos" :key="i" :src="src" alt="" />
        </div>
        <div v-else class="muted">No photos yet.</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useParksStore } from '../store/parksStore'
import { useAuthStore } from '../store/authStore' // assuming you have this

const route = useRoute()
const store = useParksStore()
const auth = useAuthStore()

const id = route.params.id
const park = ref(null)

onMounted(async () => {
  park.value = await store.loadOne(String(id))
})

const visited = computed(() => store.visitedSet.has(String(id)))
function toggleVisited() {
  store.toggleVisited(String(id))
}

const isAdmin = computed(() => !!auth?.isAdmin)

const photos = computed(() => (park.value?.photos || []).slice(0, 24))

const statusBadge = computed(() => {
  const s = (park.value?.status || 'open').toLowerCase()
  if (s === 'closed') return { class: 'closed', text: 'Closed' }
  if (s === 'construction')
    return { class: 'construction', text: 'Under construction' }
  return null
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
</style>
