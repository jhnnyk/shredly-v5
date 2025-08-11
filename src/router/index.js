import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../pages/HomeView.vue'
import AdminParkList from '../pages/AdminParkList.vue'
import AdminParkEditor from '../pages/AdminParkEditor.vue'
import { useAuthStore } from '../store/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/admin/parks',
      name: 'adminParks',
      component: AdminParkList,
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/parks/:id',
      name: 'adminParkEditor',
      component: AdminParkEditor,
      meta: { requiresAdmin: true },
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true
  const auth = useAuthStore()
  // wait until auth loaded
  if (auth.loading) {
    await new Promise((resolve) => {
      const stop = auth.$subscribe(() => {
        if (!auth.loading) {
          stop()
          resolve()
        }
      })
    })
  }
  if (!auth.user) return { name: 'home' }
  if (!auth.isAdmin) return { name: 'home' }
  return true
})

export default router
