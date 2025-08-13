<template>
  <form @submit.prevent="onSave" @keydown.enter.prevent class="card p-16">
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
            inputmode="decimal"
            min="-90"
            max="90"
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
            inputmode="decimal"
            min="-180"
            max="180"
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

      <!-- Tags -->
      <div>
        <label>Tags</label>
        <TagInput
          v-model="local.tags"
          placeholder="Add tags (comma, space, or Enter)"
        />
        <div class="hint">
          Press comma, space, or Enter to add. Paste works too.
        </div>
      </div>
    </div>
  </form>
</template>

<script setup>
import { reactive, watch } from 'vue'
import TagInput from './TagInput.vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  isNew: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Ensure tags is always an array in local state
const local = reactive({
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
  status: 'open',
  tags: Array.isArray(props.modelValue?.tags) ? props.modelValue.tags : [],
  ...props.modelValue,
})

// Keep local in sync if parent modelValue changes
watch(
  () => props.modelValue,
  (v) => {
    Object.assign(local, v || {})
    if (!Array.isArray(local.tags)) local.tags = []
  }
)

function toNum(v) {
  if (typeof v === 'string') v = v.replace(',', '.').trim()
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function normalizeTags(arr) {
  const out = []
  const seen = new Set()
  for (const t of arr || []) {
    const v = String(t).trim().replace(/\s+/g, ' ')
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

function onSave() {
  // required fields
  if (!local.name) return
  const lat = toNum(local.lat)
  const lng = toNum(local.lng)
  // bounds check
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    alert('Please enter valid coordinates: lat −90..90, lng −180..180.')
    return
  }
  // optional small normalizations
  if (local.state) local.state = String(local.state).trim().toUpperCase()
  if (
    local.openedYear &&
    (local.openedYear < 1900 || local.openedYear > 2100)
  ) {
    local.openedYear = null
  }
  emit('save', { ...local, lat, lng, tags: normalizeTags(local.tags) })
}
</script>
