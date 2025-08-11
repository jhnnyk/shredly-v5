<template>
  <div class="sheet-wrap" @click.self="$emit('close')">
    <div class="sheet">
      <div class="grab"></div>
      <header class="head">
        <div class="title">
          <div class="name">{{ park?.name }}</div>
          <div class="sub">
            {{ [park?.city, park?.state].filter(Boolean).join(', ') }}
          </div>
        </div>
        <div class="actions">
          <button class="btn" @click="$emit('toggleVisited')">
            {{ visited ? 'Visited ✓' : 'Mark visited' }}
          </button>
          <RouterLink
            :to="{ name: 'park', params: { id: park.id } }"
            class="btn btn-ghost"
            >Open</RouterLink
          >
        </div>
      </header>

      <div v-if="statusBadge" class="stamp" :class="statusBadge.class">
        {{ statusBadge.text }}
      </div>

      <div class="photos" v-if="photos && photos.length">
        <img
          v-for="(src, i) in photos.slice(0, 8)"
          :key="i"
          :src="src"
          alt=""
        />
      </div>

      <ul class="facts">
        <li v-if="park?.sizeSqft">
          📏 {{ Number(park.sizeSqft).toLocaleString() }} sqft
        </li>
        <li v-if="park?.builder">🏗️ {{ park.builder }}</li>
        <li v-if="park?.openedYear">📅 Opened {{ park.openedYear }}</li>
        <li v-if="park?.hours">🕒 {{ park.hours }}</li>
      </ul>

      <div class="chips" v-if="park?.tags?.length">
        <span class="tag" v-for="t in park.tags" :key="t">{{ t }}</span>
      </div>

      <footer class="foot">
        <button class="btn btn-ghost" @click="$emit('close')">Close</button>
        <RouterLink
          :to="{ name: 'park', params: { id: park.id } }"
          class="btn btn-primary"
          >View page</RouterLink
        >
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, toRefs } from 'vue'

const props = defineProps({
  park: { type: Object, required: true },
  visited: { type: Boolean, default: false },
  photos: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'toggleVisited'])

const { park, visited, photos } = toRefs(props)

const statusBadge = computed(() => {
  const s = (park.value?.status || 'open').toLowerCase()
  if (s === 'closed') return { class: 'closed', text: 'Closed' }
  if (s === 'construction')
    return { class: 'construction', text: 'Under construction' }
  return null
})
</script>

<style scoped>
.sheet-wrap {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  z-index: 50;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  background: #0e1726;
  border: 1px solid var(--outline);
  border-bottom: none;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.45);
  padding: 10px 12px 14px;
  max-height: 78vh;
  overflow: auto;
  position: relative;
}
.grab {
  width: 42px;
  height: 4px;
  border-radius: 999px;
  background: #2a3751;
  margin: 6px auto 10px;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.title .name {
  font-family: 'Sedgwick Ave Display', cursive;
  font-size: 22px;
}
.title .sub {
  color: var(--text-2);
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 8px;
}

.photos {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 10px 0;
}
.photos img {
  width: 100%;
  aspect-ratio: 1/1;
  object-fit: cover;
  border-radius: 8px;
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
.foot {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}

.stamp {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  font-family: 'Protest Guerrilla', system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
</style>
