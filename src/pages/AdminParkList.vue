<template>
  <section>
    <div class="flex items-center justify-between">
      <h2 style="margin: 0; font-family: 'Sonsie One', system-ui">
        Parks (Admin)
      </h2>
      <router-link
        class="btn btn-primary"
        :to="{ name: 'adminParkEditor', params: { id: 'new' } }"
        >New Park</router-link
      >
    </div>

    <div class="mt-16">
      <input
        class="input"
        v-model="q"
        placeholder="Filter by name, city, state"
      />
    </div>

    <div class="card mt-16 p-16">
      <div class="table-grid">
        <div class="thead table-cols">
          <div>Name</div>
          <div>City</div>
          <div>State</div>
          <div>Size</div>
          <div>Status</div>
          <div>Tags</div>
          <div>Actions</div>
        </div>

        <VirtualList :items="filtered" :itemHeight="60" :buffer="8">
          <template #default="{ item: p, style }">
            <div v-if="p" class="row table-cols" :style="style">
              <div>{{ p.name }}</div>
              <div>{{ p.city }}</div>
              <div>{{ p.state }}</div>
              <div>{{ p.sizeSqft?.toLocaleString?.() }}</div>
              <div>
                <span class="tag">{{
                  (p.status || 'open') === 'construction'
                    ? 'Under construction'
                    : p.status || 'open'
                }}</span>
              </div>
              <div class="tags-cell">
                <span v-for="t in p.tags || []" :key="t" class="tag">{{
                  t
                }}</span>
              </div>
              <div class="actions-row">
                <router-link
                  class="btn btn-ghost"
                  :to="{ name: 'adminParkEditor', params: { id: p.id } }"
                  >Edit</router-link
                >
                <button class="btn" @click="remove(p.id)">Delete</button>
              </div>
            </div>
          </template>
        </VirtualList>

        <div v-if="!filtered.length" class="empty">No parks yet.</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAdminParksStore } from '../store/parksAdminStore'
import VirtualList from '../components/VirtualList.vue'

const store = useAdminParksStore()
const q = ref('')
onMounted(() => store.subscribe())

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return store.parks
  return store.parks.filter((p) =>
    (p.name + ' ' + (p.city || '') + ' ' + (p.state || ''))
      .toLowerCase()
      .includes(s)
  )
})

async function remove(id) {
  if (confirm('Delete this park?')) await store.deletePark(id)
}
</script>

<style scoped>
.table-grid {
  width: 100%;
}
.table-cols {
  display: grid;
  grid-template-columns: 2fr 1fr 0.6fr 1fr 0.8fr 1.4fr auto;
  column-gap: 8px;
}
.thead {
  font-weight: 800;
  color: var(--text);
  border-bottom: 1px solid var(--outline);
}
.thead > div,
.row > div {
  padding: 8px 10px;
}
.row {
  border-bottom: 1px solid var(--outline);
  align-items: center;
  transition: background 0.15s ease;
}
.row:hover {
  background: rgba(255, 255, 255, 0.03);
}
.row > div {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tags-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: hidden;
}
.tags-cell .tag {
  white-space: nowrap;
}
.empty {
  padding: 12px 10px;
  color: var(--text-2);
}
</style>
