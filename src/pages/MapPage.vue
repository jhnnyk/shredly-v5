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
let markerMap = new Map()
let clusterMarkerMap = new Map()
let markerSyncHandle = 0
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
      setupParksSource()
      updateParksSource()
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
  open: { bg: '#5ea2ff', icon: 'skateboarding' },
  visited: { bg: '#24d87a', icon: 'check' },
  closed: { bg: '#e74c3c', icon: 'close' },
  construction: { bg: '#f1c40f', icon: 'build' },
}

function pinSpec(status, isVisited) {
  const s = (status || 'open').toLowerCase()
  if (s === 'closed') return COLORS.closed
  if (s === 'construction') return COLORS.construction
  if (isVisited) return COLORS.visited
  return COLORS.open
}

const PIN_PATH =
  'M2 6V6.29266C2 7.72154 2.4863 9.10788 3.37892 10.2236L8 16L12.6211 10.2236C13.5137 9.10788 14 7.72154 14 6.29266V6C14 2.68629 11.3137 0 8 0C4.68629 0 2 2.68629 2 6Z'

function makeParkPinSvg(park) {
  const spec = pinSpec(park.status, visited.value.has(park.id))
  const root = document.createElement('div')
  root.className = 'pinx'
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label', park.name ? `${park.name}` : 'Skatepark')
  root.innerHTML = `
    <svg class="pinx-svg" viewBox="0 0 16 16" aria-hidden="true" preserveAspectRatio="xMidYMax meet" focusable="false">
      <path class="pinx-shape" d="${PIN_PATH}"/>
    </svg>
    <span class="ms pinx-icon" aria-hidden="true">${spec.icon}</span>
  `
  root.style.setProperty('--pin-bg', spec.bg)
  return root
}

function updatePin(el, park) {
  if (!el || !park) return
  const spec = pinSpec(park.status, visited.value.has(park.id))
  el.style.setProperty('--pin-bg', spec.bg)
  el.setAttribute('aria-label', park.name ? `${park.name}` : 'Skatepark')
  const icon = el.querySelector('.pinx-icon')
  if (icon) icon.textContent = spec.icon
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bestCover(p) {
  const c = p?.cover || null
  // Popups are small → prefer small image, then fall back
  return c?.sm?.webp || c?.sm?.jpg || c?.md?.webp || c?.md?.jpg || ''
}

function openPopupForPark(p) {
  currentPopupParkId = p.id
  if (!map || !maplibre || !p) return
  if (openPopup) {
    openPopup.remove()
    openPopup = null
  }

  const cover = bestCover(p)
  const bgStyle = cover ? `style="background-image:url('${cover}');"` : ''

  const sizeMeta = Number.isFinite(Number(p.sizeSqft))
    ? `<span class="ms icon" aria-hidden="true">square_foot</span>
        ${Number(p.sizeSqft).toLocaleString()} sqft
      `
    : ''
  const tags =
    Array.isArray(p.tags) && p.tags.length
      ? `<div class="pp-tags">${p.tags
          .map((t) => `<span>#${esc(t)}</span>`)
          .join('')}</div>`
      : ''

  const html = `
    <div class="pp ${cover ? 'has-cover' : ''}">
      <div class="pp-bg" ${bgStyle} aria-hidden="true"></div>
      <div class="pp-footer pp-view" role="button" tabindex="0" aria-label="View details">
        <div class="pp-text">
          <div class="pp-name">${esc(p.name)}</div>
          <div class="pp-meta">
            ${sizeMeta}
            ${tags}
          </div>
        </div>
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
    if (view) {
      view.onclick = () => router.push({ name: 'park', params: { id: p.id } })
      view.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push({ name: 'park', params: { id: p.id } })
        }
      }
    }
  }, 0)
}

function buildParksGeoJSON() {
  const features = []
  const visitedSet = visited.value || new Set()
  for (const p of store.parks || []) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    const likes = typeof p.likesCount === 'number' ? p.likesCount : 0
    const createdMillis = (() => {
      const value = p.createdAt
      if (!value) return 0
      if (typeof value === 'number') return value
      if (typeof value?.seconds === 'number')
        return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6
      return 0
    })()
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        status: (p.status || 'open').toLowerCase(),
        visited: visitedSet.has(p.id) ? 1 : 0,
        likes,
        createdMillis,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function updateParksSource() {
  const data = buildParksGeoJSON()
  if (!mapReady.value || !map) return
  const source = map.getSource('parks')
  if (!source) return
  source.setData(data)
  scheduleMarkerSync()
}

function setupParksSource() {
  if (!map || !maplibre) return
  if (map.getSource('parks')) return

  map.addSource('parks', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 55,
  })

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'parks',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': 'rgba(47, 92, 255, 0.75)',
      'circle-stroke-color': 'rgba(10, 20, 35, 0.85)',
      'circle-stroke-width': 1.2,
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        16,
        10,
        20,
        30,
        26,
      ],
    },
  })

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'parks',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold'],
      'text-size': 12,
      'text-anchor': 'center',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#f8fbff',
    },
  })

  map.addLayer({
    id: 'unclustered-park',
    type: 'circle',
    source: 'parks',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#000',
      'circle-radius': 0.1,
      'circle-opacity': 0,
      'circle-stroke-width': 0,
    },
  })

  map.on('click', 'clusters', (e) => {
    const source = map.getSource('parks')
    if (!source) return
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
    const feature = features?.[0]
    if (!feature) return
    const clusterId = Number(feature.properties?.cluster_id)
    if (!Number.isFinite(clusterId)) return
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return
      map.easeTo({ center: feature.geometry.coordinates, zoom })
    })
  })

  updateParksSource()
  map.on('moveend', scheduleMarkerSync)
  map.on('zoomend', scheduleMarkerSync)
  map.on('data', (e) => {
    if (e.sourceId === 'parks' && e.isSourceLoaded) scheduleMarkerSync()
  })
  scheduleMarkerSync()
}

function scheduleMarkerSync() {
  if (!map || !mapReady.value) return
  if (markerSyncHandle) cancelAnimationFrame(markerSyncHandle)
  markerSyncHandle = requestAnimationFrame(() => {
    markerSyncHandle = 0
    syncDOMMarkers()
  })
}
function syncDOMMarkers() {
  if (!map || !mapReady.value) return
  let clusterFeatures = []
  let parkFeatures = []
  try {
    clusterFeatures = map.queryRenderedFeatures(undefined, { layers: ['clusters'] })
  } catch {}
  try {
    parkFeatures = map.queryRenderedFeatures(undefined, { layers: ['unclustered-park'] })
  } catch {}
  updateClusterMarkers(clusterFeatures)
  updateParkMarkers(parkFeatures)
}

function updateParkMarkers(features) {
  if (!features) return
  const keep = new Set()
  for (const feature of features) {
    const id = String(feature.properties?.id || '')
    if (!id) continue
    const park = store.byId(id) || store.parks.find((p) => p.id === id)
    if (!park) continue
    keep.add(id)
    if (markerMap.has(id)) {
      const marker = markerMap.get(id)
      updatePin(marker.getElement(), park)
      marker.setLngLat([park.lng, park.lat])
    } else {
      const el = makeParkPinSvg(park)
      el.style.cursor = 'pointer'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const latest = store.byId(id) || store.parks.find((p) => p.id === id) || park
        openPopupForPark(latest)
      })
      const mk = new maplibre.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([park.lng, park.lat])
        .addTo(map)
      markerMap.set(id, mk)
    }
  }
  for (const [id, marker] of markerMap) {
    if (!keep.has(id)) {
      marker.remove()
      markerMap.delete(id)
    }
  }
}

function updateClusterMarkers(features) {
  if (!features) return
  const keep = new Set()
  for (const feature of features) {
    const clusterId = feature.properties?.cluster_id
    const id = clusterId != null ? String(clusterId) : ''
    if (!id) continue
    keep.add(id)
    const count = feature.properties?.point_count || 0
    const coords = feature.geometry?.coordinates || [0, 0]
    if (clusterMarkerMap.has(id)) {
      const { marker, el } = clusterMarkerMap.get(id)
      el.textContent = String(count)
      el.dataset.clusterId = id
      el.dataset.lng = String(coords[0])
      el.dataset.lat = String(coords[1])
      marker.setLngLat(coords)
    } else {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'cluster-marker'
      el.textContent = String(count)
      el.dataset.clusterId = id
      el.dataset.lng = String(coords[0])
      el.dataset.lat = String(coords[1])
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const src = map.getSource('parks')
        if (!src) return
        const cid = Number(el.dataset.clusterId || '')
        const lng = Number(el.dataset.lng || 0)
        const lat = Number(el.dataset.lat || 0)
        if (!Number.isFinite(cid)) return
        src.getClusterExpansionZoom(cid, (err, zoom) => {
          if (err) return
          map.easeTo({ center: [lng, lat], zoom })
        })
      })
      el.addEventListener('mouseenter', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      el.addEventListener('mouseleave', () => {
        map.getCanvas().style.cursor = ''
      })
      const marker = new maplibre.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .addTo(map)
      clusterMarkerMap.set(id, { marker, el })
    }
  }
  for (const [id, entry] of clusterMarkerMap) {
    if (!keep.has(id)) {
      entry.marker.remove()
      clusterMarkerMap.delete(id)
    }
  }
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
  updateParksSource()
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
  // window resize handling (debounced) for fitting bounds
  const onResize = () => setTimeout(() => fitToContent(10), 150)
  window.addEventListener('resize', onResize)
  onBeforeUnmount(() => window.removeEventListener('resize', onResize))
})

onBeforeUnmount(() => {
  try {
    for (const [, mk] of markerMap) mk.remove()
    markerMap.clear()
    for (const [, entry] of clusterMarkerMap) entry.marker.remove()
    clusterMarkerMap.clear()
    if (markerSyncHandle) cancelAnimationFrame(markerSyncHandle)
    if (map) map.remove()
    map = null
  } catch {}
})

watch(
  () => nearest.value,
  () => {
    updateParksSource()
    scheduleMarkerSync()
    nextTick(() => fitToContent(10))
  },
  { deep: true }
)

watch(
  () => store.parks,
  () => {
    updateParksSource()
    scheduleMarkerSync()
  },
  { deep: true }
)
watch(
  () => hasUserLoc.value,
  () => {
    placeUserMarker()
    nextTick(() => fitToContent(10))
  }
)

watch(
  () => vstore.set,
  () => {
    updateParksSource()
    scheduleMarkerSync()
  },
  { deep: false }
)
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
  background: transparent;
  border: none;
  color: var(--text);
  border-radius: 12px;
  padding: 0;
  min-width: 220px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
:deep(.park-popup .maplibregl-popup-close-button) {
  width: 34px;
  height: 34px;
  font-size: 24px;
  color: #e7edff;
  right: 2px;
  top: 2px;
}
:deep(.park-popup .maplibregl-popup-tip) {
  border-top-color: transparent !important;
  border-bottom-color: transparent !important;
}
:deep(.park-popup .pp) {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  height: 150px; /* fixed popup height for all parks */
}
:deep(.park-popup .pp-bg) {
  position: absolute;
  inset: 0;
  background-color: #0e1726; /* fallback */
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}
:deep(.park-popup .pp-footer) {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 12px 12px;
  background: rgba(10, 20, 35, 0.42);
  backdrop-filter: blur(2px);
  box-shadow: 0 -20px 40px -10px rgba(10, 20, 35, 0.5) inset;
  display: flex;
  align-items: center;
  cursor: pointer;
}
:deep(.park-popup .pp-text) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
:deep(.park-popup .pp-name) {
  font-weight: 800;
  font-size: 16px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:deep(.park-popup .pp-meta) {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--text-2);
}

:deep(.park-popup .pp-tags) {
  display: flex;
  margin-left: 6px;
  gap: 6px;
  flex-wrap: wrap;
}
:deep(.park-popup .pp-sub) {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
:deep(.park-popup .icon) {
  margin-right: 0;
}

/* Keep overlay below markers so it can't steal clicks in Safari */
.map-ui {
  z-index: 5;
}

:global(.cluster-marker) {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(47, 92, 255, 0.85);
  border: 1px solid rgba(10, 20, 35, 0.85);
  color: #f8fbff;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  padding: 0;
  border: none;
}
:global(.cluster-marker:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

</style>
