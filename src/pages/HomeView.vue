<template>
  <section>
    <div class="hero card p-16">
      <h1>Shredly</h1>
      <p>Find every skatepark in the USA. Track where you’ve rolled. Share the stoke.</p>
    </div>

    <div class="section-title">Search</div>
    <div class="search grid" style="grid-template-columns: 1fr auto; gap:10px;">
      <input class="input" v-model="q" placeholder="Search by name, city, tags…" @input="onSearch" />
      <button class="btn btn-primary" @click="onSearch">Search</button>
    </div>

    <div class="section-title">Map</div>
    <MapView />

    <div class="section-title">Nearby parks</div>
    <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap:16px;">
      <ParkCard
        v-for="p in parks"
        :key="p.id"
        :name="p.name"
        :cityState="p.city + ', ' + p.state"
        :size="p.size"
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
import MapView from '../components/MapView.vue'
import { useParksStore } from '../store/parksStore'

const store = useParksStore()
const q = ref(store.query)

onMounted(() => { store.bootstrapDemo() })

const parks = computed(() => store.filteredParks)
const visited = computed(() => store.visitedSet)

function onSearch(){ store.setQuery(q.value) }
function toggleVisited(id){ store.toggleVisited(id) }
function openDetails(id){ alert('Details stub for ' + id) }
</script>

<style scoped>
.hero{ background: linear-gradient(180deg, rgba(255,62,165,.08), rgba(255,62,165,0) 40%); border: 1px dashed rgba(255,255,255,.08); }
.hero h1{ margin:0; font-family:"Sonsie One", system-ui; font-size:28px; letter-spacing:.3px; }
.hero p{ margin:6px 0 0 0; color:var(--text-2); }
.search{ background:var(--bg-elev); border:1px solid var(--outline); border-radius:var(--radius); box-shadow:var(--shadow-1); padding:14px; }
</style>