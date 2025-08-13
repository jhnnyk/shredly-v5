<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Add tags (comma, space, or Enter)' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const tags = ref([...props.modelValue])
const draft = ref('')

watch(
  () => props.modelValue,
  (v) => {
    tags.value = [...(v || [])]
  }
)

function normalize(t) {
  return t.trim().replace(/\s+/g, ' ')
}
function addFromDraft() {
  const t = normalize(draft.value)
  if (!t) return
  if (!tags.value.includes(t)) tags.value = [...tags.value, t]
  draft.value = ''
  emit('update:modelValue', tags.value)
}
function onKey(e) {
  if (props.disabled) return
  const k = e.key
  if (k === 'Enter' || k === ',' || k === ' ') {
    e.preventDefault()
    addFromDraft()
  } else if (k === 'Backspace' && !draft.value && tags.value.length) {
    // backspace with empty input → remove last tag (common UX)
    tags.value = tags.value.slice(0, -1)
    emit('update:modelValue', tags.value)
  }
}
function removeAt(i) {
  const next = tags.value.slice()
  next.splice(i, 1)
  tags.value = next
  emit('update:modelValue', tags.value)
}
function onPaste(e) {
  // allow pasting "bowl, lights  street" etc.
  const text = e.clipboardData?.getData('text') || ''
  if (!text) return
  e.preventDefault()
  const parts = text
    .split(/[,\s]+/)
    .map(normalize)
    .filter(Boolean)
  if (!parts.length) return
  const set = new Set(tags.value)
  parts.forEach((p) => set.add(p))
  tags.value = [...set]
  emit('update:modelValue', tags.value)
  nextTick(() => (draft.value = ''))
}
</script>

<template>
  <div class="tag-input" :class="{ disabled }">
    <span v-for="(t, i) in tags" :key="t + i" class="chip">
      {{ t }}
      <button class="x" type="button" @click="removeAt(i)" aria-label="Remove">
        ×
      </button>
    </span>
    <input
      :placeholder="tags.length ? '' : placeholder"
      v-model="draft"
      :disabled="disabled"
      @keydown="onKey"
      @paste="onPaste"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
  </div>
</template>

<style scoped>
.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--outline);
  border-radius: 8px;
  background: #0e1a2b;
}
.tag-input.disabled {
  opacity: 0.6;
  pointer-events: none;
}
.tag-input input {
  min-width: 120px;
  flex: 1 1 120px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  padding: 4px 2px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #10233a;
  border: 1px solid #2b3b5a;
  color: var(--text-2);
  font-weight: 700;
  font-size: 12px;
}
.chip .x {
  appearance: none;
  border: 0;
  background: transparent;
  color: #9eb0d1;
  cursor: pointer;
  line-height: 1;
  font-size: 14px;
  padding: 0;
}
.chip .x:hover {
  color: var(--accent);
}
</style>
