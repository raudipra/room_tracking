import Vue from 'vue'
import Dashboard from './Dashboard.vue'
import vuetify from '@/plugins/vuetify'

Vue.config.productionTip = false

new Vue({
  vuetify,
  render: h => h(Dashboard)
}).$mount('#app')
