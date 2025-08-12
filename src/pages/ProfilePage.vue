<template>
  <section>
    <div class="card p-16">
      <h2 v-if="isSelf" style="margin: 0; font-family: 'Sonsie One', system-ui">
        Your profile
      </h2>
      <h2 v-else style="margin: 0; font-family: 'Sonsie One', system-ui">
        {{ userData.displayName }}
      </h2>
      <div class="mt-16">
        <div v-if="auth.user">
          <div class="section-title">Stats</div>
          <div
            class="grid"
            style="
              grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
              gap: 12px;
            "
          >
            <div class="card p-16">
              <div class="text-muted">Visited parks</div>
              <div style="font-size: 28px; font-weight: 700">
                {{ visitedCount }}
              </div>
            </div>
            <div class="card p-16">
              <div class="text-muted">Photos added</div>
              <div style="font-size: 28px; font-weight: 700">
                {{ photoCount }}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Photos</div>
            <div v-if="photos.length" class="photos">
              <div v-for="p in photos" :key="p.id" class="photo-tile">
                <img
                  v-if="p.status === 'ready'"
                  :src="
                    p.outputs?.md?.webp ||
                    p.outputs?.md?.jpg ||
                    p.outputs?.sm?.webp ||
                    p.outputs?.sm?.jpg
                  "
                  loading="lazy"
                  decoding="async"
                  alt=""
                />
                <div v-else class="ph processing">Processing…</div>

                <!-- credit links to the park -->
                <RouterLink
                  class="credit"
                  :to="{ name: 'park', params: { id: p.parkId } }"
                >
                  View park
                </RouterLink>
              </div>
            </div>
            <div v-else class="muted">No photos yet.</div>
          </div>

          <div class="mt-16 flex g-8">
            <button v-if="isSelf" class="btn" @click="auth.logout">
              Log out
            </button>
            <router-link
              v-if="auth.isAdmin"
              class="btn btn-primary"
              :to="{ name: 'adminParkEditor', params: { id: 'new' } }"
              >Add a park (admin)</router-link
            >
            <router-link
              v-if="auth.isAdmin"
              class="btn btn-ghost"
              :to="{ name: 'adminParks' }"
              >Manage parks</router-link
            >
          </div>
        </div>

        <div v-else>
          <div class="text-muted">
            Log in to track your visited parks and add photos.
          </div>
          <div class="mt-16">
            <button class="btn btn-primary" @click="showAuth = true">
              Log in or sign up
            </button>
          </div>
        </div>
      </div>
    </div>

    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { useParksStore } from '../store/parksStore'

import AuthModal from '../components/AuthModal.vue'

const route = useRoute()
const auth = useAuthStore()
const parks = useParksStore()
const showAuth = ref(false)

const visitedCount = computed(() => parks.visited.length)
const photoCount = computed(() => auth.profile?.photoCount || 0)
const initials = computed(() => {
  const n = auth.displayName || 'S'
  return n
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

// whose profile are we showing?
const viewingUid = computed(() =>
  route.params.uid ? String(route.params.uid) : auth.user?.uid || null
)
const isSelf = computed(() => !!auth.user && viewingUid.value === auth.user.uid)

// basic user data for the header (displayName etc.)
const userData = ref({ displayName: '' })

// their photos (public)
const photos = ref([])

async function loadUser(uid) {
  if (!uid) return
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    userData.value = snap.exists() ? snap.data() : { displayName: '' }
  } catch {
    userData.value = { displayName: '' }
  }
}

function watchPhotos(uid) {
  if (!uid) return
  const q = query(
    collection(db, 'photos'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    photos.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  })
}

let unsubPhotos = null
onMounted(async () => {
  await loadUser(viewingUid.value)
  unsubPhotos = watchPhotos(viewingUid.value)
})
watch(viewingUid, async (uid) => {
  unsubPhotos && unsubPhotos()
  unsubPhotos = null
  await loadUser(uid)
  unsubPhotos = watchPhotos(uid)
})

// expose logout if you already have it
// function logout() {
//   auth.logout?.()
// }
</script>
