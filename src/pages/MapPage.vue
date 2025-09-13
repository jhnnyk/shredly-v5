<!-- src/pages/MapPage.vue -->
<template>
  <section>
    <div class="card map-card">
      <div class="map-wrap map-wrap--lg" ref="mapEl">
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
    <div ref="listEl">
      <VirtualGrid :items="nearest" :itemMinWidth="260" :gap="16">
        <template #default="{ item: p, style }">
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
              :distanceKm="hasUserLoc ? p._d : null"
            />
          </div>
        </template>
      </VirtualGrid>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import ParkCard from '../components/ParkCard.vue'
import VirtualGrid from '../components/VirtualGrid.vue'
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
let markerMap = new Map() // id -> Marker
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
  // .slice(0, 50)
})

function toggleVisited(id) {
  store.toggleVisited(id)
}

async function initMap() {
  try {
    await ensureMapCss()
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
      updateMarkersInView()
      bindMapMoveUpdates()
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

const COLORS = {
  open: { bg: '#5ea2ff' }, // blue
  visited: { bg: '#24d87a' }, // green
  closed: { bg: '#e74c3c' }, // red
  construction: { bg: '#f1c40f' }, // yellow
}

function pinSpec(status, isVisited) {
  const s = (status || 'open').toLowerCase()
  if (s === 'closed') return { key: 'closed', icon: 'close' }
  if (s === 'construction') return { key: 'construction', icon: 'build' }
  if (isVisited) return { key: 'visited', icon: 'check' }
  return { key: 'open', icon: 'skateboarding' }
}

const PIN_PATH =
  'M2 6V6.29266C2 7.72154 2.4863 9.10788 3.37892 10.2236L8 16L12.6211 10.2236C13.5137 9.10788 14 7.72154 14 6.29266V6C14 2.68629 11.3137 0 8 0C4.68629 0 2 2.68629 2 6Z'

function makeParkPinSvg(isVisited = false, status = 'open', name = '') {
  const { key, icon } = pinSpec(status, isVisited)
  const c = COLORS[key]

  const root = document.createElement('div')
  root.className = `pinx pinx--${key}`
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label', name ? `${name} (${key})` : key)

  root.innerHTML = `
    <svg class="pinx-svg" viewBox="0 0 16 16" aria-hidden="true" preserveAspectRatio="xMidYMax meet" focusable="false">
      <path class="pinx-shape" d="${PIN_PATH}"/>
    </svg>
    <span class="ms pinx-icon" aria-hidden="true">${icon}</span>
  `

  root.style.setProperty('--pin-bg', c.bg)

  return root
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

const MAX_MARKERS = 600
function parksInView(limit = MAX_MARKERS) {
  if (!map) return []
  const b = map.getBounds()
  const west = b.getWest(), east = b.getEast(), south = b.getSouth(), north = b.getNorth()
  const inBox = nearest.value.filter(
    (p) => p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north
  )
  return inBox.slice(0, limit)
}

function updateMarkersInView() {
  if (!map || !maplibre) return
  const keep = new Set(parksInView().map((p) => p.id))
  // remove markers that are no longer needed
  for (const [id, mk] of markerMap) {
    if (!keep.has(id)) {
      mk.remove()
      markerMap.delete(id)
    }
  }
  // add/update needed markers
  for (const p of nearest.value) {
    if (!keep.has(p.id)) continue
    if (markerMap.has(p.id)) {
      // update appearance
      const mk = markerMap.get(p.id)
      const elem = mk.getElement()
      const spec = pinSpec(p.status, visited.value.has(p.id))
      const c = COLORS[spec.key]
      elem.style.setProperty('--pin-bg', c.bg)
      continue
    }
    const el = makeParkPinSvg(
      visited.value.has(p.id),
      p.status || 'open',
      p.name
    )
    el.style.cursor = 'pointer'
    const mk = new maplibre.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([p.lng, p.lat])
      .addTo(map)
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
    markerMap.set(p.id, mk)
  }
}

function bindMapMoveUpdates() {
  if (!map) return
  const refresh = () => updateMarkersInView()
  map.on('moveend', refresh)
  map.on('zoomend', refresh)
}

// Removed map-wide hit testing in favor of marker clicks for performance.

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

// lazy-load MapLibre CSS when the map page mounts
let mapCssLoaded = false
async function ensureMapCss() {
  if (mapCssLoaded) return
  const href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css'
  if (document.querySelector(`link[href="${href}"]`)) {
    mapCssLoaded = true
    return
  }
  await new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    document.head.appendChild(link)
  })
  mapCssLoaded = true
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

onBeforeUnmount(() => {
  try {
    for (const [, mk] of markerMap) mk.remove()
    markerMap.clear()
    if (map) map.remove()
  } catch {}
})

watch(
  () => nearest.value,
  () => {
    updateMarkersInView()
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

watch(
  () => vstore.set,
  () => {
    // update visited styling: rebuild nearby markers
    updateMarkersInView()
  },
  { deep: false }
)

window.addEventListener('resize', () => setTimeout(fitToContent(10), 150))
</script>

<style scoped>
/* base map styles come from tokens.css (.map-wrap, .map-placeholder) */

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
  border: 1px solid var(--outline);
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--bg-elev);
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
  background: var(--bg-elev);
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
  border: 1px solid var(--outline);
  border-radius: 999px;
  padding: 6px 10px;
  background: var(--bg-elev);
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
  /* z-index: 40; */
  pointer-events: auto !important;
}

/* Keep overlay below markers so it can't steal clicks in Safari */
.map-ui {
  z-index: 5;
}
</style>
