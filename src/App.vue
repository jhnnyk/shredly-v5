<template>
  <div class="app">
    <main class="container">
      <router-view />
    </main>
    <BottomNav />
  </div>
</template>

<script setup>
import BottomNav from './components/BottomNav.vue'
</script>

<style>
.app { min-height: 100vh; color: var(--text); }
</style>