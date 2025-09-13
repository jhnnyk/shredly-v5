<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  itemHeight: { type: Number, default: 56 },
  buffer: { type: Number, default: 6 },
  autoHeight: { type: Boolean, default: true },
})

const root = ref(null)
const state = reactive({
  height: 0,
  start: 0,
  end: 0,
  rowH: 56,
})

function calc() {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const viewportH = window.innerHeight || document.documentElement.clientHeight
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
  const top = rect.top + scrollTop
  const relTop = Math.max(0, scrollTop - top)
  const relBottom = relTop + viewportH
  const rowH = Math.max(1, state.rowH)
  const total = props.items.length
  state.height = total * rowH
  let s = Math.floor(relTop / rowH) - props.buffer
  let e = Math.ceil(relBottom / rowH) + props.buffer
  s = Math.max(0, s)
  e = Math.min(total - 1, e)
  state.start = s
  state.end = e
}

let ro, raf = 0
function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(calc)
}

onMounted(() => {
  ro = new ResizeObserver(calc)
  ro.observe(root.value)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  nextTick(calc)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(raf)
})

watch(() => props.items.length, () => nextTick(calc))
// Also recalc when the array reference changes (e.g., filtering) even if length stays similar
watch(() => props.items, () => nextTick(calc))

const measureHost = ref(null)
let roMeasure
onMounted(() => {
  if (!props.autoHeight) return
  if (!measureHost.value) return
  roMeasure = new ResizeObserver((entries) => {
    for (const e of entries) {
      const h = e.contentRect?.height || e.target.getBoundingClientRect().height
      if (!h || !Number.isFinite(h)) continue
      if (Math.abs(h - state.rowH) > 1) {
        state.rowH = h
        calc()
      }
    }
  })
  roMeasure.observe(measureHost.value)
})
onBeforeUnmount(() => {
  try { roMeasure && roMeasure.disconnect() } catch {}
})

function styleFor(i) {
  const y = i * Math.max(1, state.rowH)
  return {
    position: 'absolute',
    left: '0',
    right: '0',
    top: '0',
    height: state.rowH + 'px',
    transform: `translateY(${y}px)`,
  }
}
</script>

<template>
  <div ref="root" class="vlist" :style="{ position: 'relative', minHeight: '1px' }">
    <div class="vlist-spacer" :style="{ height: state.height + 'px' }" />
    <slot
      v-for="i in Math.max(0, state.end - state.start + 1)"
      :key="(state.start + i - 1)"
      :index="(state.start + i - 1)"
      :item="items[state.start + i - 1]"
      :style="styleFor(state.start + i - 1)"
    />
    <div
      v-if="autoHeight && items.length"
      ref="measureHost"
      style="position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;right:0;height:auto;overflow:visible"
    >
      <slot :index="0" :item="items[0]" />
    </div>
  </div>
</template>

<style scoped>
.vlist {}
.vlist-spacer {}
</style>
