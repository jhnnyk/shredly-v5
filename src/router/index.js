import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../pages/HomeView.vue'
import { useAuthStore } from '../store/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/map',
      name: 'map',
      component: () => import('../pages/MapPage.vue'),
      meta: { title: 'Skatepark Map | Shredly' },
    },
    {
      path: '/park/:id',
      name: 'park',
      component: () => import('../pages/ParkDetailPage.vue'),
      props: true,
      meta: { title: 'Skatepark | Shredly' },
    },
    {
      path: '/profile/:uid?',
      name: 'profile',
      component: () => import('../pages/ProfilePage.vue'),
      props: true,
      meta: { title: 'Shredly profile' },
    },
    {
      path: '/admin/parks',
      name: 'adminParks',
      component: () => import('../pages/AdminParkList.vue'),
      meta: { requiresAdmin: true, title: 'Shredly admin' },
    },
    {
      path: '/admin/parks/:id',
      name: 'adminParkEditor',
      component: () => import('../pages/AdminParkEditor.vue'),
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
