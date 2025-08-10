<template>
  <div class="app">
    <AppHeader @open-auth="showAuth = true" />
    <main class="container">
      <HomeView />
    </main>
    <AuthModal v-if="showAuth" @close="showAuth = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import HomeView from './pages/HomeView.vue'
import AuthModal from './components/AuthModal.vue'

const showAuth = ref(false)
</script>

<style>
.app { min-height: 100vh; color: var(--text); }
</style>