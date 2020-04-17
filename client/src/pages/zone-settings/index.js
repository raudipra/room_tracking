import Vue from 'vue'
import ZoneSettings from './ZoneSettings.vue'
import vuetify from '@/plugins/vuetify'

Vue.config.productionTip = false

new Vue({
  vuetify,
  render: h => h(ZoneSettings)
}).$mount('#app')
