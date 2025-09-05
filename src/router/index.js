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
    {
      path: '/map',
      name: 'map',
      component: MapPage,
      meta: { title: 'Skatepark Map | Shredly' },
    },
    {
      path: '/park/:id',
      name: 'park',
      component: ParkDetailPage,
      props: true,
      meta: { title: 'Skatepark | Shredly' },
    },
    {
      path: '/profile/:uid?',
      name: 'profile',
      component: ProfilePage,
      props: true,
      meta: { title: 'Shredly profile' },
    },
    {
      path: '/admin/parks',
      name: 'adminParks',
      component: AdminParkList,
      meta: { requiresAdmin: true, title: 'Shredly admin' },
    },
    {
      path: '/admin/parks/:id',
      name: 'adminParkEditor',
      component: AdminParkEditor,
      meta: { requiresAdmin: true, title: 'Shredly admin' },
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

router.afterEach((to) => {
  const defaultTitle = 'Shredly'
  document.title = to.meta.title || defaultTitle
})

export default router
