import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import OtherPage from '../views/OtherPage.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/other', component: OtherPage }
]

const router = createRouter({
  history: createWebHashHistory(), // <-- HASH mode for GitHub Pages
  routes
})

export default router