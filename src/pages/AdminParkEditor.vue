<template>
  <section>
    <router-link class="btn btn-ghost" :to="{ name: 'adminParks' }"
      >← Back</router-link
    >
    <div class="mt-16">
      <ParkForm
        :modelValue="park"
        :isNew="isNew"
        @save="save"
        @cancel="goBack"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ParkForm from '../components/ParkForm.vue'
import { useAdminParksStore } from '../store/parksAdminStore'

const route = useRoute()
const router = useRouter()
const store = useAdminParksStore()

const id = computed(() => route.params.id)
const isNew = computed(() => id.value === 'new')
const park = ref({})

onMounted(async () => {
  if (isNew.value) {
    park.value = {
      name: '',
      address: '',
      city: '',
      state: '',
      lat: null,
      lng: null,
      sizeSqft: null,
      builder: '',
      openedYear: null,
      hours: '',
      tags: [],
    }
  } else {
    const p = await store.getPark(id.value)
    if (!p) {
      alert('Park not found')
      goBack()
      return
    }
    park.value = p
  }
})

async function save(data) {
  if (isNew.value) {
    const newId = await store.createPark(data)
    router.replace({ name: 'adminParkEditor', params: { id: newId } })
  } else {
    await store.updatePark(id.value, data)
  }
  alert('Saved ✅')
}
function goBack() {
  router.push({ name: 'adminParks' })
}
</script>
