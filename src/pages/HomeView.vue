<template>
  <section>
    <h1>Shredly</h1>
    <p class="tagline">Gotta shred 'em all!</p>

    <div class="section-title">Search</div>
    <div class="search grid" style="grid-template-columns: 1fr auto; gap: 10px">
      <input
        class="input"
        v-model="q"
        placeholder="Search by name, city, tags…"
        @input="onSearch"
      />
      <button class="btn btn-primary" @click="onSearch">Search</button>
    </div>

    <div class="section-title">Parks</div>
    <div
      class="grid"
      style="
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 16px;
      "
    >
      <ParkCard
        v-for="p in parks"
        :key="p.id"
        :id="p.id"
        :name="p.name"
        :status="p.status || 'open'"
        :cityState="(p.city || '') + (p.state ? ', ' + p.state : '')"
        :size="p.sizeSqft"
        :builder="p.builder"
        :hours="p.hours"
        :tags="p.tags"
        :visited="vstore.isVisited(p.id)"
        @toggleVisited="vstore.toggle(p.id)"
        :cover="p.cover"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ParkCard from '../components/ParkCard.vue'
import { useParksStore } from '../store/parksStore'
import { useVisitedStore } from '../store/visitedStore'

const store = useParksStore()
const vstore = useVisitedStore()
const q = ref(store.query)

onMounted(() => {
  store.start()
})

const parks = computed(() => store.filteredParks)

function onSearch() {
  store.setQuery(q.value)
}
function toggleVisited(id) {
  store.toggleVisited(id)
}
function openDetails(id) {
  alert('Details stub for ' + id)
}
</script>
