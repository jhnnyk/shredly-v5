<template>
  <section>
    <div class="card map-card">
      <div class="map-wrap" ref="mapEl">
        <div v-if="!mapReady" class="map-placeholder">Map loading…</div>
      </div>
    </div>

    <div class="section-title">Nearest skateparks</div>
    <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap:16px;">
      <ParkCard
        v-for="p in nearest"
        :key="p.id"
        :name="p.name"
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
import { ref, computed, onMounted, watch } from 'vue'
import ParkCard from '../components/ParkCard.vue'
import { useParksStore } from '../store/parksStore'

const store = useParksStore()
const mapEl = ref(null)
const mapReady = ref(false)
const center = ref({ lat: 39.5, lng: -98.35 }) // US centroid fallback
const hasUserLoc = ref(false)
let map, maplibre

function haversine(a, b){
  const toRad = (x) => x * Math.PI / 180
  const R = 6371 // km
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const s = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)*Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s))
  return R * c
}

const visited = computed(() => store.visitedSet)
const nearest = computed(() => {
  const parks = store.parks || []
  const distances = parks
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map(p => ({ ...p, _d: haversine(center.value, { lat: p.lat, lng: p.lng }) }))
    .sort((a,b) => a._d - b._d)
    .slice(0, 24)
  return distances
})

function toggleVisited(id){ store.toggleVisited(id) }
function openDetails(id){ alert('Details stub for ' + id) }

async function initMap(){
  try {
    maplibre = await import('maplibre-gl')
    map = new maplibre.Map({
      container: mapEl.value,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [center.value.lng, center.value.lat],
      zoom: hasUserLoc.value ? 11 : 4
    })
    map.addControl(new maplibre.NavigationControl({ visualizePitch: true }))
    map.on('load', () => {
      mapReady.value = true
      drawMarkers()
    })
  } catch (e){
    console.warn('MapLibre failed, fallback to placeholder', e)
    mapReady.value = false
  }
}

function drawMarkers(){
  if(!map || !maplibre) return
  (window.__markers || []).forEach(m => m.remove())
  window.__markers = []

  if(hasUserLoc.value){
    const el = document.createElement('div')
    el.style.width = '14px'; el.style.height = '14px'; el.style.borderRadius = '50%'
    el.style.background = 'var(--accent)'
    el.style.boxShadow = '0 0 0 0 rgba(255,62,165,.6)'
    el.style.animation = 'pulse 2.2s infinite'
    window.__markers.push(new maplibre.Marker({ element: el }).setLngLat([center.value.lng, center.value.lat]).addTo(map))
  }

  const parks = nearest.value
  for(const p of parks){
    const el = document.createElement('div')
    el.style.width = '10px'; el.style.height = '10px'; el.style.borderRadius = '50%'
    el.style.background = '#a8c7ff'
    el.style.border = '1px solid #fff2'
    el.title = p.name
    const mk = new maplibre.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
    window.__markers.push(mk)
  }
}

onMounted(() => {
  store.start()
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        center.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        hasUserLoc.value = true
        if(map){ map.setCenter([center.value.lng, center.value.lat]); map.setZoom(11); drawMarkers() }
      },
      () => { /* keep fallback center */ },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }
  initMap()
})

watch(() => nearest.value, () => drawMarkers())
</script>