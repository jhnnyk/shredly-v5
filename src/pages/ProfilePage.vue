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
                <span v-if="userData?.visitedCount != null">
                  {{ userData.visitedCount }}
                </span>
              </div>
            </div>
            <div class="card p-16">
              <div class="text-muted">Photos added</div>
              <div style="font-size: 28px; font-weight: 700">
                {{ photos.length }}
              </div>
            </div>
          </div>

          <div class="card p-16 mt-16">
            <div class="section-title">Photos</div>
            <PhotoGrid
              v-if="photos.length"
              :photos="photos"
              :showCredit="true"
              credit-type="park"
              @open="openLB"
            />
            <div v-else class="muted">No photos yet.</div>
            <PhotoLightbox
              v-model:show="showLB"
              :photos="viewablePhotos"
              :startIndex="lbIndex"
            />
          </div>

          <div class="mt-16 flex g-8">
            <button v-if="isSelf" class="btn" @click="auth.logout">
              Log out
            </button>
            <router-link
              v-if="auth.isAdmin && isSelf"
              class="btn btn-primary"
              :to="{ name: 'adminParkEditor', params: { id: 'new' } }"
              >Add a park (admin)</router-link
            >
            <router-link
              v-if="auth.isAdmin && isSelf"
              class="btn btn-ghost"
              :to="{ name: 'adminParks' }"
              >Manage parks</router-link
            >
          </div>
        </div>

        <div v-else>
          <div>Log in to track your visited parks and add photos.</div>
          <div class="mt-16" style="display: flex; gap: 8px; flex-wrap: wrap">
            <button class="btn btn-primary" @click="openAuth('login')">
              Log in
            </button>
            <button class="btn btn-ghost" @click="openAuth('signup')">
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>

    <AuthModal v-if="showAuth" :mode="authMode" @close="showAuth = false" />
  </section>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
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
import PhotoGrid from '../components/PhotoGrid.vue'
import PhotoLightbox from '../components/PhotoLightbox.vue'
import AuthModal from '../components/AuthModal.vue'

const route = useRoute()
const auth = useAuthStore()
const showAuth = ref(false)
const authMode = ref('login')
const showLB = ref(false)
const lbIndex = ref(0)

function openAuth(mode = 'login') {
  authMode.value = mode
  showAuth.value = true
}

// auto-close the modal when the user becomes authenticated
watch(
  () => auth.user,
  (u) => {
    if (u && showAuth.value) {
      showAuth.value = false
    }
  }
)

// whose profile are we showing?
const viewingUid = computed(() =>
  route.params.uid ? String(route.params.uid) : auth.user?.uid || null
)
const isSelf = computed(() => !!auth.user && viewingUid.value === auth.user.uid)

// basic user data for the header (displayName etc.)
const userData = ref({ displayName: '' })

// their photos (public)
const photos = ref([])
const viewablePhotos = computed(() =>
  photos.value.filter((p) => p.status === 'ready')
)

function openLB(idOrIndex) {
  const list = viewablePhotos.value
  const i =
    typeof idOrIndex === 'number'
      ? idOrIndex
      : list.findIndex((p) => p.id === idOrIndex)
  lbIndex.value = i >= 0 ? i : 0
  showLB.value = true
}

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
  resetProfileState()
  if (!uid) return
  await loadUser(uid)
  unsubPhotos = watchPhotos(uid)
})

// reset helper
function resetProfileState() {
  userData.value = { displayName: '' }
  photos.value = []
  if (unsubPhotos) {
    unsubPhotos()
    unsubPhotos = null
  }
}

// when auth.user changes, react accordingly
watch(
  () => auth.user,
  async (u) => {
    if (!u) {
      // logged out → clear stale data
      resetProfileState()
      // if you're on /profile (no :uid), stay and show login prompt
      // if you're viewing someone else via :uid, load that user's data
      if (route.params.uid) {
        await loadUser(String(route.params.uid))
        unsubPhotos = watchPhotos(String(route.params.uid))
      }
      return
    }
    // logged in → if viewing self (no :uid), load current user
    if (!route.params.uid) {
      await loadUser(u.uid)
      unsubPhotos = watchPhotos(u.uid)
    }
  },
  { immediate: false }
)

// tidy up on unmount
onBeforeUnmount(() => {
  if (unsubPhotos) unsubPhotos()
})
</script>
