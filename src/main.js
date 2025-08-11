import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/utils.css'
import 'maplibre-gl/dist/maplibre-gl.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// init auth AFTER pinia
import { useAuthStore } from './store/authStore'
useAuthStore().init()

app.mount('#app')
