import Vue from 'vue'
import ZonePeopleHistorical from './ZonePeopleHistorical.vue'
import '@/plugins/quasar'

Vue.config.productionTip = false

new Vue({
  render: h => h(ZonePeopleHistorical)
}).$mount('#app')
