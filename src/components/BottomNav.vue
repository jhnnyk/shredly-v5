<template>
  <nav class="bottom-nav" role="navigation" aria-label="Primary">
    <RouterLink :to="{ name: 'home' }">
      <span class="icon" v-html="icons.home"></span>
      <span>Home</span>
    </RouterLink>
    <RouterLink :to="{ name: 'map' }">
      <span class="icon" v-html="icons.map"></span>
      <span>Map</span>
    </RouterLink>
    <RouterLink :to="{ name: 'profile' }">
      <span class="icon" v-html="icons.user"></span>
      <span>Profile</span>
    </RouterLink>
  </nav>
</template>

<script setup>
const icons = {
  home: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 10.5 12 4l8 6.5v7a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2v-7Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.6"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7.5" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 20c1.5-3.5 4.5-5.5 8-5.5s6.5 2 8 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
}
</script>
