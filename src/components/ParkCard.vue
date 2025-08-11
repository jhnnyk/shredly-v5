<template>
  <article class="card">
    <div class="card-media"></div>
    <div class="body">
      <div class="name">{{ name }}</div>
      <div class="meta">
        <span>📍 {{ cityState }}</span>
        <span v-if="size">📏 {{ Number(size).toLocaleString() }} sqft</span>
        <span v-if="builder">🏗️ {{ builder }}</span>
        <span v-if="hours">🕒 {{ hours }}</span>
      </div>
      <div class="chips">
        <span v-for="t in tags" :key="t" class="tag">{{ t }}</span>
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="$emit('toggleVisited')">
          {{ visited ? 'Visited ✓' : 'Mark visited' }}
        </button>
        <button class="btn" @click="$emit('details')">Details</button>
      </div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  name: String,
  cityState: String,
  size: [Number, String],
  builder: String,
  hours: String,
  tags: { type: Array, default: () => [] },
  visited: Boolean,
})
</script>

<style scoped>
.card-media {
  height: 140px;
  background: radial-gradient(
      600px 240px at 80% -40%,
      var(--accent-soft),
      transparent 60%
    ),
    linear-gradient(180deg, #0f1b2d, #0e1726);
  border-bottom: 1px solid var(--outline);
}
.body {
  padding: 14px;
  display: grid;
  gap: 10px;
}
.name {
  font-family: 'Sedgwick Ave Display', cursive;
  font-size: 22px;
  letter-spacing: 0.2px;
}
.meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-2);
}
.actions {
  display: flex;
  gap: 10px;
}
</style>
