<template>
  <article class="card">
    <!-- STAMP: only when status is not open -->
    <div
      v-if="status && status !== 'open'"
      class="status-stamp"
      :class="'status-' + status"
      :aria-label="status === 'construction' ? 'Under construction' : 'Closed'"
    >
      {{ status === 'construction' ? 'Under construction' : 'Closed' }}
    </div>

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
  status: { type: String, default: 'open' },
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

/* Make the card a positioning context for the stamp */
:deep(.card),
.card {
  position: relative;
}

/* Rubber-stamp style */
.status-stamp {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  font-family: 'Protest Guerrilla', system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 10px;
  border-radius: 8px;
  transform: rotate(6deg);
  font-size: 18px;
  line-height: 1;
  user-select: none;
  /* subtle distressed feel */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(1px);
}
@media (min-width: 640px) {
  .status-stamp {
    font-size: 20px;
    transform: rotate(8deg);
  }
}

/* Colorways (reuse your earlier palette, but as translucent stamps) */
.status-stamp.status-closed {
  color: #ff99b1;
  background: rgba(59, 17, 29, 0.45);
  border: 2px solid #6b1a2a;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
}
.status-stamp.status-construction {
  color: #ffef9a;
  background: rgba(44, 42, 20, 0.45);
  border: 2px solid #5a5520;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.22);
}
</style>
