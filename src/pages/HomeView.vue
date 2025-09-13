<template>
  <section>
    <h1>Shredly</h1>
    <p>{{ parks.length }} skateparks... Gotta shred 'em all!</p>

    <div class="search grid" style="grid-template-columns: 1fr auto; gap: 10px">
      <input
        class="input"
        v-model="q"
        placeholder="Search by name, city, tags…"
        @input="onSearch"
      />
      <button class="btn btn-primary" @click="onSearch">Search</button>
    </div>

    <VirtualGrid :items="parks" :itemMinWidth="260" :gap="16">
      <template #default="{ item: p, index, style }">
        <div v-if="p" :style="style">
          <ParkCard
            :id="p.id"
            :name="p.name"
            :status="p.status || 'open'"
            :cityState="(p.city || '') + (p.state ? ', ' + p.state : '')"
            :size="p.sizeSqft"
            :builder="p.builder"
            :hours="p.hours"
            :tags="p.tags"
            :visited="vstore.isVisited(p.id)"
            :cover="p.cover"
            :visitorsCount="p.visitorsCount"
            :photosCount="p.photosCount"
          />
        </div>
      </template>
    </VirtualGrid>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ParkCard from '../components/ParkCard.vue'
import VirtualGrid from '../components/VirtualGrid.vue'
import { useParksStore } from '../store/parksStore'
import { useVisitedStore } from '../store/visitedStore'

const store = useParksStore()
const vstore = useVisitedStore()
const q = ref(store.query)

onMounted(() => {
  store.start()
})

const parks = computed(() => store.filteredParks)

let t
function onSearch() {
  clearTimeout(t)
  t = setTimeout(() => store.setQuery(q.value), 120)
}
</script>
