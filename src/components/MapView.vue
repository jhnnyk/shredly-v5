<template>
  <div class="map">
    <div class="ping" title="Your location"></div>
    <div class="empty">Map placeholder — plug MapLibre here</div>
  </div>
</template>

<script setup>
// Intentionally a visual stub. Replace with MapLibre GL JS when ready.
</script>

<style scoped>
.map{
  height:260px;
  background:
    radial-gradient(600px 260px at 0% 0%, var(--accent-soft), transparent 60%),
    repeating-linear-gradient(0deg, #162541, #162541 2px, #141f31 2px, #141f31 18px);
  border:1px solid var(--outline);
  border-radius:var(--radius);
  box-shadow:var(--shadow-1);
  position:relative;
  overflow:hidden;
  display:flex; align-items:center; justify-content:center;
}
.ping{ position:absolute; width:12px; height:12px; border-radius:50%; background:var(--accent); top:50%; left:50%; transform:translate(-50%,-50%);
  box-shadow:0 0 0 0 rgba(255,62,165,.6); animation:pulse 2.2s infinite; }
@keyframes pulse{ 0%{box-shadow:0 0 0 0 rgba(255,62,165,.6);} 70%{box-shadow:0 0 0 16px rgba(255,62,165,0);} 100%{box-shadow:0 0 0 0 rgba(255,62,165,0);} }
.empty{ color:var(--text-2); font-size:13px; }
</style>