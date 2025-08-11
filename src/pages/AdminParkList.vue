<template>
  <section>
    <div class="flex items-center justify-between">
      <h2 style="margin:0;font-family:'Sonsie One',system-ui;">Parks (Admin)</h2>
      <router-link class="btn btn-primary" :to="{ name: 'adminParkEditor', params: { id: 'new' } }">New Park</router-link>
    </div>

    <div class="mt-16">
      <input class="input" v-model="q" placeholder="Filter by name, city, state" />
    </div>

    <div class="card mt-16 p-16">
      <table class="table">
        <thead>
          <tr><th>Name</th><th>City</th><th>State</th><th>Size</th><th>Tags</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in filtered" :key="p.id">
            <td>{{ p.name }}</td>
            <td>{{ p.city }}</td>
            <td>{{ p.state }}</td>
            <td>{{ p.sizeSqft?.toLocaleString?.() }}</td>
            <td>
              <span v-for="t in (p.tags||[])" :key="t" class="tag">{{ t }}</span>
            </td>
            <td class="actions-row">
              <router-link class="btn btn-ghost" :to="{ name:'adminParkEditor', params:{ id: p.id }}">Edit</router-link>
              <button class="btn" @click="remove(p.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filtered.length" class="empty">No parks yet.</div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAdminParksStore } from '../store/parksAdminStore'

const store = useAdminParksStore()
const q = ref('')
onMounted(() => store.subscribe())

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if(!s) return store.parks
  return store.parks.filter(p => (p.name + ' ' + (p.city||'') + ' ' + (p.state||'')).toLowerCase().includes(s))
})

async function remove(id){
  if(confirm('Delete this park?')) await store.deletePark(id)
}
</script>