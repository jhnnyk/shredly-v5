<!-- src/pages/MapPage.vue -->
<template>
  <section>
    <div class="card map-card">
      <div class="map-wrap" ref="mapEl">
        <div v-if="!mapReady" class="map-placeholder">Map loading…</div>

        <!-- overlay UI -->
        <div class="map-ui">
          <div class="map-actions">
            <button class="map-btn" @click="locateMe">Locate me</button>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">Nearest skateparks</div>
    <div
      ref="listEl"
      class="grid nearest-list"
      style="
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 16px;
      "
    >
      <ParkCard
        v-for="p in nearest"
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
        @toggleVisited="toggleVisited(p.id)"
        :cover="p.cover"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import ParkCard from '../components/ParkCard.vue'
import { useRoute, useRouter } from 'vue-router'

import { useParksStore } from '../store/parksStore'
import { useVisitedStore } from '../store/visitedStore'

const route = useRoute()
const router = useRouter()

const store = useParksStore()
const vstore = useVisitedStore()

const visited = computed(() => vstore.set) // a Set

const mapEl = ref(null)
const listEl = ref(null)
const mapReady = ref(false)
const center = ref({ lat: 39.5, lng: -98.35 }) // US fallback
const hasUserLoc = ref(false)
const selectedId = ref(null)

let map, maplibre
let userMarker = null
let parkMarkers = []
let openPopup = null
let currentPopupParkId = null

// OSM raster with labels (tokenless)
const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'base', type: 'raster', source: 'osm' }],
}

function haversine(a, b) {
  const toRad = (x) => (x * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

const nearest = computed(() => {
  const parks = store.parks || []
  return parks
    .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map((p) => ({
      ...p,
      _d: haversine(center.value, { lat: p.lat, lng: p.lng }),
    }))
    .sort((a, b) => a._d - b._d)
    .slice(0, 50)
})

function toggleVisited(id) {
  store.toggleVisited(id)
}

async function initMap() {
  try {
    maplibre = await import('maplibre-gl')
    map = new maplibre.Map({
      container: mapEl.value,
      style: OSM_RASTER_STYLE,
      center: [center.value.lng, center.value.lat],
      zoom: hasUserLoc.value ? 12.5 : 5.5,
      attributionControl: false,
    })
    map.addControl(
      new maplibre.NavigationControl({ visualizePitch: true }),
      'top-right'
    )
    map.addControl(
      new maplibre.AttributionControl({ compact: true }),
      'bottom-right'
    )
    map.addControl(
      new maplibre.ScaleControl({ maxWidth: 120, unit: 'imperial' })
    )

    map.on('load', () => {
      mapReady.value = true
      placeUserMarker()
      drawParkMarkers()
      bindMapHitTest()
      nextTick(() => fitToContent(10))
    })
  } catch (e) {
    console.warn('Map failed; showing placeholder', e)
    mapReady.value = false
  }
}

/* --- MARKERS --- */

// Pink pulsing user dot
function makeUserDot() {
  const outer = document.createElement('div')
  outer.style.width = '14px'
  outer.style.height = '14px'
  outer.style.borderRadius = '50%'
  outer.style.background = 'var(--accent)'
  outer.style.border = '2px solid #ff9bcc55'
  outer.style.boxShadow = '0 2px 4px rgba(0,0,0,.45)'
  outer.style.position = 'relative'

  // pulsing ring (uses global CSS above)
  const pulse = document.createElement('div')
  pulse.className = 'pulse-ring'
  outer.appendChild(pulse)

  return outer
}

function placeUserMarker() {
  if (!map || !maplibre || !hasUserLoc.value) return
  if (userMarker) {
    userMarker.remove()
    userMarker = null
  }
  userMarker = new maplibre.Marker({ element: makeUserDot() })
    .setLngLat([center.value.lng, center.value.lat])
    .addTo(map)
}

// Blue pin with skateboard
function makeParkPin(isVisited = false) {
  const el = document.createElement('div')
  el.style.width = '32px' // was 30
  el.style.height = '40px' // was 38
  el.style.transform = 'translateY(-2px)'
  el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,.45))'

  const PIN = '#5ea2ff' // slightly darker blue

  el.innerHTML = `
  <svg viewBox="0 0 24 24" width="32" height="40" aria-hidden="true">
    <!-- solid pin, no border -->
    <path d="M12 2c-3.86 0-7 3.14-7 7 0 4.9 5.2 10.9 6.57 12.4a.6.6 0 0 0 .86 0C13.8 19.9 19 13.9 19 9c0-3.86-3.14-7-7-7z"
      fill="${PIN}"/>

    <!-- wheels + deck (white) — scaled to keep same visual size as before -->
    <g transform="translate(12,10) scale(0.245) translate(-33.5,-32.95)" fill="none">
      <circle cx="20"  cy="41.9" r="3" fill="#fff"/>
      <circle cx="47.3" cy="35.9" r="3" fill="#fff"/>
      <path d="M55,24
               c0,0 -3,4.8 -7,5.6
               c0,0 -27.3,6  -31.3,6.9
               c-3.9,0.9 -8.7,-2.2 -8.7,-2.2"
            stroke="#fff" stroke-width="1.6" vector-effect="non-scaling-stroke"
            stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    ${
      isVisited
        ? `
      <!-- green check badge -->
      <g transform="translate(16,6)">
        <circle cx="0" cy="0" r="4.6" fill="#24d87a" />
        <path d="M -2 0 l 1.2 1.6 L 2.2 -1.2" fill="none" stroke="#0b321f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`
        : ''
    }
  </svg>`
  return el
}

function openPopupForPark(p) {
  currentPopupParkId = p.id
  if (!map || !maplibre || !p) return
  if (openPopup) {
    openPopup.remove()
    openPopup = null
  }

  const html = `
    <div class="pp">
      <div class="pp-name">${p.name}</div>
      <div class="pp-sub">${p.city || ''}${p.state ? `, ${p.state}` : ''}</div>
      <div class="pp-actions">
        <button class="pp-btn pp-view">View details</button>
        <button class="pp-btn pp-visit">${
          visited.value.has(p.id) ? 'Visited ✓' : 'Mark visited'
        }</button>
      </div>
    </div>`

  const pop = new maplibre.Popup({
    closeButton: true,
    offset: 18,
    className: 'park-popup',
    focusAfterOpen: false,
  })
    .setLngLat([p.lng, p.lat])
    .setHTML(html)
    .addTo(map)

  openPopup = pop

  // wire buttons after DOM is attached
  setTimeout(() => {
    const root = document.querySelector('.park-popup .pp')
    if (!root) return
    const view = root.querySelector('.pp-view')
    const visit = root.querySelector('.pp-visit')
    view &&
      (view.onclick = () => router.push({ name: 'park', params: { id: p.id } }))
    visit && (visit.onclick = () => toggleVisited(p.id))
  }, 0)
}

function drawParkMarkers() {
  if (!map || !maplibre) return
  parkMarkers.forEach((m) => m.remove())
  parkMarkers = []

  for (const p of nearest.value) {
    const el = makeParkPin(visited.value.has(p.id))
    el.style.cursor = 'pointer'

    const mk = new maplibre.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([p.lng, p.lat])
      .addTo(map)

    // Try direct DOM click (works in most browsers)
    const elem = mk.getElement()
    elem.style.pointerEvents = 'auto'
    ;['pointerup', 'click', 'touchend'].forEach((ev) =>
      elem.addEventListener(
        ev,
        (e) => {
          e.stopPropagation()
          openPopupForPark(p)
        },
        { passive: true }
      )
    )

    parkMarkers.push(mk)
  }
}

function bindMapHitTest() {
  const hit = (e) => {
    if (!map) return
    const pt = e.point || map.project(e.lngLat) // MapLibre provides e.point on 'click'
    const threshold = 22 // px radius
    let best = null,
      bestD2 = Infinity
    for (const p of nearest.value) {
      const s = map.project([p.lng, p.lat])
      const dx = s.x - pt.x,
        dy = s.y - pt.y
      const d2 = dx * dx + dy * dy
      if (d2 < bestD2) {
        bestD2 = d2
        best = p
      }
    }
    if (best && bestD2 <= threshold * threshold) openPopupForPark(best)
  }
  map.on('click', hit)
  map.on('touchend', hit)
}

/* --- CAMERA --- */

let fitTick = null
function fitToContent(count = 10) {
  if (!map || !maplibre) return
  cancelAnimationFrame(fitTick)
  fitTick = requestAnimationFrame(() => {
    const parks = (nearest.value || [])
      .slice(0, count)
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    if (!parks.length) return

    // Minimal padding since the list is below the map
    const padding = { top: 20, right: 20, bottom: 20, left: 20 }

    if (hasUserLoc.value) {
      // Keep user centered: symmetric bounds around location
      let dx = 0,
        dy = 0
      for (const p of parks) {
        dx = Math.max(dx, Math.abs(p.lng - center.value.lng))
        dy = Math.max(dy, Math.abs(p.lat - center.value.lat))
      }
      if (dx === 0) dx = 0.01
      if (dy === 0) dy = 0.01
      const expand = 1.12
      const bounds = new maplibre.LngLatBounds(
        [center.value.lng - dx * expand, center.value.lat - dy * expand],
        [center.value.lng + dx * expand, center.value.lat + dy * expand]
      )
      map.fitBounds(bounds, { padding, maxZoom: 14, duration: 500 })
    } else {
      // No user loc yet → fit parks and zoom in a bit
      const bounds = new maplibre.LngLatBounds()
      parks.forEach((p) => bounds.extend([p.lng, p.lat]))
      map.fitBounds(bounds, { padding, maxZoom: 12.5, duration: 500 })
    }
  })
}

function locateMe() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      center.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      hasUserLoc.value = true
      placeUserMarker()
      // Smooth, single recenter (no bounce)
      map.easeTo({
        center: [center.value.lng, center.value.lat],
        zoom: Math.max(map.getZoom(), 12),
        duration: 500,
      })
    },
    () => {},
    { enableHighAccuracy: true, timeout: 12000 }
  )
}

/* --- LIFECYCLE --- */

onMounted(async () => {
  store.start()
  // Prime nearest calc before map load
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        center.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        hasUserLoc.value = true
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }
  initMap()

  // deep-link: /park/:id opens the sheet
  if (route.name === 'park' && route.params.id) {
    const id = String(route.params.id)
    const p = await store.loadOne(id)
    if (p) selectedId.value = id
  }
})

watch(
  () => nearest.value,
  () => {
    drawParkMarkers()
    nextTick(fitToContent(10))
  }
)
watch(
  () => hasUserLoc.value,
  () => {
    placeUserMarker()
    nextTick(fitToContent(10))
  }
)

watch(visited, () => {
  if (!openPopup || !currentPopupParkId) return
  const btn = document.querySelector('.park-popup .pp-visit')
  if (btn)
    btn.textContent = visited.value.has(currentPopupParkId)
      ? 'Visited ✓'
      : 'Mark visited'
})

watch(
  () => vstore.set,
  () => {
    drawParkMarkers()
  },
  { deep: false }
)

window.addEventListener('resize', () => setTimeout(fitToContent(10), 150))
</script>

<style scoped>
.map-wrap {
  position: relative;
  height: 440px;
  border: 1px solid var(--outline);
  border-radius: var(--radius);
  overflow: hidden;
}
.map-placeholder {
  height: 100%;
  background: radial-gradient(
      600px 260px at 0% 0%,
      var(--accent-soft),
      transparent 60%
    ),
    repeating-linear-gradient(
      0deg,
      #162541,
      #162541 2px,
      #141f31 2px,
      #141f31 18px
    );
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
}

/* Overlay UI */
.map-ui {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.map-actions {
  position: absolute;
  left: 10px;
  top: 10px;
  display: flex;
  gap: 8px;
  z-index: 21;
  pointer-events: auto;
}

.map-btn {
  appearance: none;
  border: 1px solid #2b3b5a;
  border-radius: 999px;
  padding: 8px 12px;
  background: #0e1a2b;
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.map-btn.primary {
  background: linear-gradient(180deg, var(--accent-2), var(--accent));
  color: #0b0b10;
  border-color: #ff8fc7;
}

.map-btn:hover {
  transform: translateY(-1px);
}

.map-legend {
  position: absolute;
  left: 10px;
  bottom: 10px;
  background: #0e1a2b;
  border: 1px solid var(--outline);
  padding: 6px 10px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  color: var(--text-2);
  font-size: 12px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  border: 2px solid #ffffff22;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.dot.you {
  background: var(--accent);
  border-color: #ff9bcc55;
}
.dot.park {
  background: #7fb6ff;
  border-color: #00142888;
}

/* Pulse animation for user marker */
@keyframes pulse {
  0% {
    transform: scale(0.6);
    opacity: 0.85;
  }
  70% {
    transform: scale(1.4);
    opacity: 0;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

/* Themed popup */
:deep(.park-popup .maplibregl-popup-content) {
  background: #0e1726;
  border: 1px solid var(--outline);
  color: var(--text);
  border-radius: 12px;
  padding: 12px;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
:deep(.park-popup .maplibregl-popup-tip) {
  border-top-color: #0e1726 !important;
  border-bottom-color: #0e1726 !important;
}
:deep(.park-popup .pp-name) {
  font-weight: 800;
  margin-bottom: 2px;
}
:deep(.park-popup .pp-sub) {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 10px;
}
:deep(.park-popup .pp-actions) {
  display: flex;
  gap: 8px;
}
:deep(.park-popup .pp-btn) {
  appearance: none;
  border: 1px solid #2b3b5a;
  border-radius: 999px;
  padding: 6px 10px;
  background: #0e1a2b;
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
}
:deep(.park-popup .pp-btn:hover) {
  transform: translateY(-1px);
}
:deep(.park-popup .pp-btn.pp-view) {
  background: linear-gradient(180deg, var(--accent-2), var(--accent));
  color: #0b0b10;
  border-color: #ff8fc7;
}

/* Make sure markers are on top and clickable in Safari */
:deep(.maplibregl-marker) {
  z-index: 40;
  pointer-events: auto !important;
}

/* Keep overlay below markers so it can't steal clicks in Safari */
.map-ui {
  z-index: 5;
}
</style>
