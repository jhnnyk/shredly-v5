import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/utils.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// init auth AFTER pinia
import { useAuthStore } from './store/authStore'
useAuthStore().init()

app.mount('#app')