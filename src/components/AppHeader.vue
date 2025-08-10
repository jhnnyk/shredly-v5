<template>
  <header class="nav">
    <div class="nav-row container flex items-center justify-between g-12">
      <div class="brand flex items-center g-12">
        <div class="logo-mark"></div>
        <div class="logo-type">Shredly</div>
      </div>
      <div class="nav-actions flex g-8">
        <button class="btn btn-ghost">Log in</button>
        <button class="btn btn-primary">Add a park</button>
      </div>
    </div>
  </header>
</template>

<script setup>
</script>

<style scoped>
.nav{ position:sticky; top:0; z-index:10; background: rgba(16,24,39,.82); backdrop-filter: blur(10px); border-bottom:1px solid var(--outline); }
.nav-row{ padding:12px 16px; }
.logo-type{ font-family:"Sonsie One", system-ui; font-size:24px; letter-spacing:.5px; line-height:1; text-shadow:0 2px 0 rgba(0,0,0,.25); position:relative;}
.logo-type::after{ content:""; position:absolute; left:2px; right:-6px; bottom:-6px; height:6px; background:linear-gradient(90deg, transparent, var(--accent), transparent); border-radius:6px; opacity:.7; }
.logo-mark{ width:32px; height:32px; border-radius:12px; background: conic-gradient(from 210deg, var(--accent) 0 25%, var(--accent-2) 25% 55%, #6cc6ff 55% 75%, #ffd07a 75% 100%); box-shadow: var(--shadow-1); }
</style>