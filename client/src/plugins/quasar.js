import Vue from 'vue'

import '@/styles/quasar.scss'
import iconSet from 'quasar/icon-set/mdi-v5.js'
import '@quasar/extras/mdi-v5/mdi-v5.css'
import { Quasar, Notify } from 'quasar'

Vue.use(Quasar, {
  config: {},
  components: {},
  directives: {},
  plugins: {
    Notify
  },
  iconSet: iconSet
})
