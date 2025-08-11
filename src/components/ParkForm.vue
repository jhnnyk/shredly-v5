<template>
  <form @submit.prevent="onSave" class="card p-16">
    <div class="flex items-center justify-between">
      <h2 style="margin: 0; font-family: 'Sonsie One', system-ui">
        {{ isNew ? 'New Park' : 'Edit Park' }}
      </h2>
      <div class="actions-row">
        <button type="button" class="btn" @click="$emit('cancel')">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary">
          {{ isNew ? 'Create' : 'Save' }}
        </button>
      </div>
    </div>

    <hr />

    <div class="form-grid">
      <div>
        <label>Name *</label>
        <input class="input" v-model="local.name" required />
      </div>

      <div>
        <label>Address</label>
        <input
          class="input"
          v-model="local.address"
          placeholder="123 Main St, City, ST"
        />
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px">
        <div>
          <label>City</label>
          <input class="input" v-model="local.city" />
        </div>
        <div>
          <label>State</label>
          <input class="input" v-model="local.state" placeholder="CO" />
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px">
        <div>
          <label>Latitude *</label>
          <input
            class="input"
            v-model.number="local.lat"
            type="number"
            step="any"
            required
          />
        </div>
        <div>
          <label>Longitude *</label>
          <input
            class="input"
            v-model.number="local.lng"
            type="number"
            step="any"
            required
          />
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px">
        <div>
          <label>Size (sqft)</label>
          <input
            class="input"
            v-model.number="local.sizeSqft"
            type="number"
            min="0"
          />
        </div>
        <div>
          <label>Builder</label>
          <input
            class="input"
            v-model="local.builder"
            placeholder="e.g., Dreamland, Grindline"
          />
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px">
        <div>
          <label>Opened year</label>
          <input
            class="input"
            v-model.number="local.openedYear"
            type="number"
            min="1900"
            max="2100"
          />
        </div>
        <div>
          <label>Hours</label>
          <input
            class="input"
            v-model="local.hours"
            placeholder="e.g., 7am–10pm; 24 hours"
          />
        </div>
      </div>

      <div>
        <label>Status</label>
        <select class="input" v-model="local.status">
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="construction">Under construction</option>
        </select>
      </div>

      <div>
        <label>Tags (comma-separated)</label>
        <input
          class="input"
          v-model="tagsText"
          placeholder="indoor, lights, prefab"
        />
        <div class="mt-8">
          <span v-for="t in parsedTags" :key="t" class="tag">{{ t }}</span>
        </div>
      </div>
    </div>
  </form>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  isNew: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const local = reactive({ ...props.modelValue })
watch(
  () => props.modelValue,
  (v) => Object.assign(local, v || {})
)

const tagsText = computed({
  get() {
    return (local.tags || []).join(', ')
  },
  set(v) {
    local.tags = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  },
})
const parsedTags = computed(() => local.tags || [])

function onSave() {
  if (!local.name || local.lat == null || local.lng == null) return
  emit('save', { ...local, tags: parsedTags.value })
}
</script>
