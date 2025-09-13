<script setup>
import { ref, onMounted, onBeforeUnmount, reactive, watch, nextTick } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  itemMinWidth: { type: Number, default: 260 },
  itemHeight: { type: Number, default: 0 }, // 0 => auto-measure
  gap: { type: Number, default: 16 },
  bufferRows: { type: Number, default: 3 },
  autoHeight: { type: Boolean, default: true },
  aspectRatio: { type: Number, default: 16 / 9 }, // width / height; rowH = colW / aspectRatio
})

const root = ref(null)
const state = reactive({
  width: 0,
  cols: 1,
  startRow: 0,
  endRow: 0,
  top: 0,
  height: 0,
  colW: 0,
  measuredH: 0,
})

let ro, raf = 0

function calcLayout() {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  state.width = rect.width
  const cols = Math.max(1, Math.floor((state.width + props.gap) / (props.itemMinWidth + props.gap)))
  state.cols = cols
  // distribute width evenly across columns (fill container)
  const colW = Math.max(1, Math.floor((state.width - (cols - 1) * props.gap) / cols))
  state.colW = colW
  const rows = Math.ceil(props.items.length / cols) || 1
  // total content height including gaps
  const rowH = getRowH()
  state.height = rows * (rowH + props.gap) - props.gap
  // compute visible rows w.r.t. viewport
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
  const viewportH = window.innerHeight || document.documentElement.clientHeight
  const containerTop = rect.top + scrollTop
  const relTop = Math.max(0, scrollTop - containerTop)
  const relBottom = relTop + viewportH
  const rowH2 = rowH + props.gap
  let startRow = Math.floor(relTop / rowH2) - props.bufferRows
  let endRow = Math.ceil(relBottom / rowH2) + props.bufferRows
  startRow = Math.max(0, startRow)
  endRow = Math.min(rows - 1, endRow)
  state.startRow = startRow
  state.endRow = endRow
  state.top = containerTop
}

function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(calcLayout)
}

onMounted(() => {
  ro = new ResizeObserver(calcLayout)
  ro.observe(root.value)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  nextTick(calcLayout)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(raf)
})

watch(() => props.items.length, () => nextTick(calcLayout))

function getRowH() {
  if (props.aspectRatio && props.aspectRatio > 0 && state.colW > 0) {
    return Math.ceil(state.colW / props.aspectRatio)
  }
  if (props.autoHeight && state.measuredH > 0) return Math.ceil(state.measuredH)
  return Math.max(1, props.itemHeight || 240)
}

function styleForIndex(i) {
  const col = i % state.cols
  const row = Math.floor(i / state.cols)
  const x = col * (state.colW + props.gap)
  const y = row * (getRowH() + props.gap)
  return {
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: state.colW + 'px',
    height: getRowH() + 'px',
    transform: `translate(${x}px, ${y}px)`,
  }
}

const emit = defineEmits(['range'])
watch(
  () => [state.startRow, state.endRow, state.cols],
  () => emit('range', { startRow: state.startRow, endRow: state.endRow, cols: state.cols })
)
// hidden measurement host to compute row height at current column width
const measureHost = ref(null)
let roMeasure
onMounted(() => {
  if (!measureHost.value) return
  roMeasure = new ResizeObserver((entries) => {
    for (const e of entries) {
      const h = e.contentRect?.height || e.target.getBoundingClientRect().height
      if (!h || !Number.isFinite(h)) continue
      if (Math.abs(h - state.measuredH) > 1) {
        state.measuredH = h
        calcLayout()
      }
    }
  })
  roMeasure.observe(measureHost.value)
})
onBeforeUnmount(() => {
  try { roMeasure && roMeasure.disconnect() } catch {}
})
</script>

<template>
  <div ref="root" class="vgrid" :style="{ position: 'relative', minHeight: '1px' }">
    <div class="vgrid-spacer" :style="{ height: state.height + 'px' }"></div>
    <template v-if="state.cols > 0">
      <slot
        v-for="i in Math.max(0, (state.endRow - state.startRow + 1) * state.cols)"
        :key="i + '-' + state.startRow + '-' + state.cols"
        :index="(state.startRow * state.cols) + (i - 1)"
        :item="items[(state.startRow * state.cols) + (i - 1)]"
        :style="styleForIndex((state.startRow * state.cols) + (i - 1))"
      />
    </template>
    <!-- hidden measure item: lets us auto-size row height to content at current column width -->
    <div
      v-if="autoHeight && state.colW > 0 && items.length > 0"
      ref="measureHost"
      :style="{
        position: 'absolute',
        visibility: 'hidden',
        pointerEvents: 'none',
        left: '0',
        top: '0',
        width: state.colW + 'px',
        height: 'auto',
        overflow: 'visible'
      }"
    >
      <slot :index="0" :item="items[0]" :style="{ width: state.colW + 'px' }" />
    </div>
  </div>
  
</template>

<style scoped>
.vgrid {
  /* ensure layout width matches grid calculations */
}
.vgrid-spacer {
  /* nothing; just reserves height */
}
</style>
