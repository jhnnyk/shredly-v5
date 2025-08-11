<template>
  <section>
    <div class="hero card p-16">
      <h1>Shredly</h1>
      <p>
        Find every skatepark in the USA. Track where you’ve rolled. Share the
        stoke.
      </p>
    </div>

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
        :name="p.name"
        :status="p.status || 'open'"
        :cityState="(p.city || '') + (p.state ? ', ' + p.state : '')"
        :size="p.sizeSqft"
        :builder="p.builder"
        :hours="p.hours"
        :tags="p.tags"
        :visited="visited.has(p.id)"
        @toggleVisited="toggleVisited(p.id)"
        @details="openDetails(p.id)"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ParkCard from '../components/ParkCard.vue'
import { useParksStore } from '../store/parksStore'

const store = useParksStore()
const q = ref(store.query)

onMounted(() => {
  store.start()
})

const parks = computed(() => store.filteredParks)
const visited = computed(() => store.visitedSet)

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
