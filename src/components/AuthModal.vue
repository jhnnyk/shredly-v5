<template>
  <div
    class="modal-backdrop"
    ref="backdropRef"
    @keydown.esc="$emit('close')"
    tabindex="0"
  >
    <div class="modal">
      <div class="flex items-center justify-between">
        <div style="font-weight: 700">
          {{ mode === 'login' ? 'Log in' : 'Create account' }}
        </div>
        <button class="btn btn-ghost" @click="$emit('close')">Close</button>
      </div>

      <div v-if="mode === 'signup'" class="mt-8">
        <label>Display name</label>
        <input
          class="input"
          v-model="displayName"
          placeholder="e.g., shredder45"
          autocomplete="nickname"
          required
        />
        <p class="hint" aria-live="polite">
          <span v-if="nameStatus === 'checking'">Checking availability…</span>
          <span v-else-if="nameStatus === 'taken'" class="error"
            >That name is taken.</span
          >
          <span v-else-if="nameStatus === 'available'" class="success"
            >Name is available!</span
          >
        </p>
      </div>

      <div class="mt-16">
        <label>Email</label>
        <input
          class="input"
          v-model="email"
          placeholder="you@example.com"
          autocomplete="email"
        />
      </div>
      <div class="mt-8">
        <label>Password</label>
        <input
          class="input"
          v-model="password"
          type="password"
          :autocomplete="
            mode === 'signup' ? 'new-password' : 'current-password'
          "
          placeholder="••••••••"
          @keyup.enter="submit"
        />
      </div>

      <div class="mt-16 flex g-8">
        <button
          class="btn btn-primary"
          @click="submit"
          :disabled="
            loading ||
            (mode === 'signup' && !canSubmitSignup && nameStatus !== 'idle')
          "
        >
          {{ mode === 'login' ? 'Log in' : 'Sign up' }}
        </button>
        <button class="btn" @click="toggle" :disabled="loading">
          {{
            mode === 'login'
              ? 'Need an account? Sign up'
              : 'Have an account? Log in'
          }}
        </button>
      </div>

      <div class="mt-8 error" v-if="error" role="alert" aria-live="assertive">
        {{ error }}
      </div>
      <div class="mt-8 success" v-if="message" role="status" aria-live="polite">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../store/authStore'
import { checkDisplayNameAvailability } from '../store/authStore'

// accept a mode prop from the parent
const props = defineProps({
  mode: { type: String, default: 'login' }, // 'login' | 'signup'
})
const emit = defineEmits(['close'])

const auth = useAuthStore()

// local state mirrors the prop, so we can toggle internally
const mode = ref(props.mode)
watch(
  () => props.mode,
  (v) => {
    if (v && v !== mode.value) mode.value = v
  }
)

const email = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref('')
const message = ref('')
const nameStatus = ref('idle')
let nameCheckTimer = null

const isDisplayNameValid = computed(() => {
  const v = (displayName.value || '').trim()
  return v.length >= 2 && v.length <= 30 && /^[\w\-\.' ]+$/.test(v)
})

const canSubmitSignup = computed(() => {
  if (!isDisplayNameValid.value) return false
  return nameStatus.value === 'available'
})

watch(
  [mode, displayName],
  ([m, name]) => {
    if (m !== 'signup') {
      nameStatus.value = 'idle'
      return
    }
    const trimmed = (name || '').trim()
    clearTimeout(nameCheckTimer)
    if (!trimmed) {
      nameStatus.value = 'idle'
      return
    }
    if (!isDisplayNameValid.value) {
      nameStatus.value = 'invalid'
      return
    }
    nameStatus.value = 'checking'
    const query = trimmed
    nameCheckTimer = setTimeout(async () => {
      const available = await checkDisplayNameAvailability(query)
      if ((displayName.value || '').trim() !== query) return
      nameStatus.value = available ? 'available' : 'taken'
    }, 250)
  },
  { immediate: true }
)

async function submit() {
  loading.value = true
  error.value = ''
  message.value = ''
  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value)
      message.value = 'Logged in!'
      emit('close') // close immediately on success
    } else {
      if (!isDisplayNameValid.value) {
        throw new Error('Please enter a display name (2–30 characters).')
      }
      const trimmed = (displayName.value || '').trim()
      const available = await checkDisplayNameAvailability(trimmed)
      if (!available) {
        nameStatus.value = 'taken'
        throw new Error('That display name is already taken. Choose another.')
      }
      await auth.signup(email.value, password.value, trimmed)
      emit('close')
    }
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

function toggle() {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
}

// make Esc work even if inner inputs have focus initially
const backdropRef = ref(null)
onMounted(() => {
  // defer to next tick to ensure element is in DOM
  requestAnimationFrame(() => backdropRef.value?.focus?.())
})
</script>
