<template>
  <div class="app">
    <AppHeader />
    <main class="container">
      <HomeView />
    </main>
  </div>
</template>

<script setup>
import AppHeader from './components/AppHeader.vue'
import HomeView from './pages/HomeView.vue'
</script>

<style>
.app { background: radial-gradient(1200px 800px at 20% -20%, #13223a 0%, var(--bg) 48%); min-height: 100vh; color: var(--text); }
.container { max-width: 1040px; margin: 0 auto; padding: 16px; }
</style>