<template>
  <div class="app">
    <AppHeader @open-auth="goLogin" />
    <main class="container">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import AppHeader from './components/AppHeader.vue'
import { useRouter } from 'vue-router'
const router = useRouter()
function goLogin() {
  router.push({ name: 'home', query: { login: '1' } })
}
</script>

<style>
.app {
  min-height: 100vh;
  color: var(--text);
}
</style>
