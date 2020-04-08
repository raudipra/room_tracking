import Vue from 'vue'
import ZonePeopleHistorical from './ZonePeopleHistorical.vue'
import vuetify from '@/plugins/vuetify'

Vue.config.productionTip = false

new Vue({
  vuetify,
  render: h => h(ZonePeopleHistorical)
}).$mount('#app')
