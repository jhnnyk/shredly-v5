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
              :liked-photo-ids="likedByMe"
              @open="openLB"
              @toggle-like="toggleLike"
            />
            <div v-else class="muted">No photos yet.</div>
            <PhotoLightbox
              v-model:show="showLB"
              :photos="viewablePhotos"
              :startIndex="lbIndex"
              :liked-photo-ids="likedByMe"
              @toggle-like="toggleLike"
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
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import PhotoGrid from '../components/PhotoGrid.vue'
import PhotoLightbox from '../components/PhotoLightbox.vue'
import AuthModal from '../components/AuthModal.vue'
import { normalizePhotoDoc, sortPhotosByLikes } from '../utils/photos'

const route = useRoute()
const auth = useAuthStore()
const showAuth = ref(false)
const authMode = ref('login')
const showLB = ref(false)
const lbIndex = ref(0)
const currentUserId = computed(() => auth.user?.uid || '')
const likedByMe = ref({})
let likeSyncToken = 0
const photoOrder = ref([])

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

async function refreshLikedState() {
  const uid = currentUserId.value
  const seq = ++likeSyncToken
  if (!uid) {
    likedByMe.value = {}
    return
  }
  const ready = photos.value.filter((p) => p.status === 'ready')
  if (!ready.length) {
    likedByMe.value = {}
    return
  }
  try {
    const results = await Promise.all(
      ready.map(async (p) => {
        const snap = await getDoc(doc(db, 'photos', p.id, 'likes', uid))
        return [p.id, snap.exists()]
      })
    )
    if (seq !== likeSyncToken) return
    const map = {}
    for (const [pid, liked] of results) {
      if (liked) map[pid] = true
    }
    likedByMe.value = map
  } catch (err) {
    console.warn('Failed to load like state', err)
  }
}

function openLB(idOrIndex) {
  const list = viewablePhotos.value
  const i =
    typeof idOrIndex === 'number'
      ? idOrIndex
      : list.findIndex((p) => p.id === idOrIndex)
  lbIndex.value = i >= 0 ? i : 0
  showLB.value = true
}

watch(currentUserId, () => {
  refreshLikedState()
})

watch(
  () => photos.value.map((p) => `${p.id}:${p.status}`).join('|'),
  () => {
    refreshLikedState()
  }
)

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
    const list = snap.docs
      .map((d) => normalizePhotoDoc(d))
      .filter(Boolean)
    if (!photoOrder.value.length) {
      photoOrder.value = sortPhotosByLikes(list).map((p) => p.id)
    }

    const seen = new Set(photoOrder.value)
    const newcomers = list.filter((p) => !seen.has(p.id))
    if (newcomers.length) {
      const orderedNew = sortPhotosByLikes(newcomers).map((p) => p.id)
      photoOrder.value = [...photoOrder.value, ...orderedNew]
    }

    const byId = {}
    for (const p of list) byId[p.id] = p

    const ordered = []
    const nextOrder = []
    for (const id of photoOrder.value) {
      if (byId[id]) {
        ordered.push(byId[id])
        nextOrder.push(id)
      }
    }
    photoOrder.value = nextOrder
    photos.value = ordered
    refreshLikedState()
  })
}

async function toggleLike(photoId) {
  if (!auth.user) {
    openAuth('login')
    return
  }
  const uid = currentUserId.value
  if (!uid) return
  const idx = photos.value.findIndex((p) => p.id === photoId)
  if (idx < 0) return
  const original = photos.value[idx]
  if (!original || original.status !== 'ready') return
  const alreadyLiked = !!likedByMe.value[photoId]
  const delta = alreadyLiked ? -1 : 1
  const previousPhotos = photos.value.slice()
  const previousLikes = { ...likedByMe.value }
  const nextLikes = { ...previousLikes }
  if (alreadyLiked) delete nextLikes[photoId]
  else nextLikes[photoId] = true
  const updated = {
    ...original,
    likesCount: Math.max(0, (original.likesCount ?? 0) + delta),
  }
  const next = photos.value.slice()
  next.splice(idx, 1, updated)
  photos.value = next
  likedByMe.value = nextLikes
  try {
    const likeRef = doc(db, 'photos', photoId, 'likes', uid)
    if (alreadyLiked) {
      await deleteDoc(likeRef)
    } else {
      await setDoc(likeRef, {
        userId: uid,
        createdAt: serverTimestamp(),
      })
    }
  } catch (err) {
    console.error('toggleLike failed', err)
    photos.value = previousPhotos
    likedByMe.value = previousLikes
  }
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
  likedByMe.value = {}
  photoOrder.value = []
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
