<template>
  <section>
    <div class="card p-16">
      <h2 style="margin:0;font-family:'Sonsie One',system-ui;">Your profile</h2>
      <div class="mt-16">
        <div v-if="auth.user">
          <div class="flex g-8 items-center">
            <div style="width:48px;height:48px;border-radius:50%;background:#12243b;border:1px solid var(--outline); display:grid;place-items:center;">
              <span style="font-weight:700;">{{ initials }}</span>
            </div>
            <div>
              <div style="font-weight:700;">{{ auth.displayName || 'Shredder' }}</div>
              <div class="text-muted">Member</div>
            </div>
          </div>

          <div class="section-title">Stats</div>
          <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap:12px;">
            <div class="card p-16">
              <div class="text-muted">Visited parks</div>
              <div style="font-size:28px; font-weight:700;">{{ visitedCount }}</div>
            </div>
            <div class="card p-16">
              <div class="text-muted">Photos added</div>
              <div style="font-size:28px; font-weight:700;">{{ photoCount }}</div>
            </div>
          </div>

          <div class="mt-16 flex g-8">
            <button class="btn" @click="auth.logout">Log out</button>
            <router-link v-if="auth.isAdmin" class="btn btn-primary" :to="{ name: 'adminParkEditor', params:{ id:'new' } }">Add a park (admin)</router-link>
            <router-link v-if="auth.isAdmin" class="btn btn-ghost" :to="{ name: 'adminParks' }">Manage parks</router-link>
          </div>
        </div>

        <div v-else>
          <div class="text-muted">Log in to track your visited parks and add photos.</div>
          <div class="mt-16">
            <button class="btn btn-primary" @click="showAuth = true">Log in or sign up</button>
          </div>
        </div>
      </div>
    </div>

    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '../store/authStore'
import { useParksStore } from '../store/parksStore'
import AuthModal from '../components/AuthModal.vue'

const auth = useAuthStore()
const parks = useParksStore()
const showAuth = ref(false)

const visitedCount = computed(() => parks.visited.length)
const photoCount = computed(() => auth.profile?.photoCount || 0)
const initials = computed(() => {
  const n = (auth.displayName || 'S')
  return n.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()
})
</script>