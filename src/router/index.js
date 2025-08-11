import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../pages/HomeView.vue'
import MapPage from '../pages/MapPage.vue'
import ParkDetailPage from '../pages/ParkDetailPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import AdminParkList from '../pages/AdminParkList.vue'
import AdminParkEditor from '../pages/AdminParkEditor.vue'
import { useAuthStore } from '../store/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/map', name: 'map', component: MapPage },
    { path: '/park/:id', name: 'park', component: ParkDetailPage, props: true },
    { path: '/me', name: 'me', component: ProfilePage },
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
  if (!auth.user) return { name: 'me' }
  if (!auth.isAdmin) return { name: 'home' }
  return true
})

export default router
