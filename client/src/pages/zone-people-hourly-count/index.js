import Vue from 'vue'
import ZonePeopleHourlyCount from './ZonePeopleHourlyCount.vue'
import vuetify from '@/plugins/vuetify'

Vue.config.productionTip = false

new Vue({
  vuetify,
  render: h => h(ZonePeopleHourlyCount)
}).$mount('#app')
