<template>
  <v-dialog :value="dialog" @input="handleDialog">
    <v-card v-if="zone !== null">
      <v-toolbar>
        <v-toolbar-title>{{ zone.name || 'UNKNOWN' }}</v-toolbar-title>
        <v-spacer/>
        <v-btn icon @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-alert :type="alertType" v-model="alert" dismissible>{{ alertMessage }}</v-alert>
      <v-tabs
        grow
        v-model="tab">
        <v-tab v-for="(item, i) in tabItems" :key="i">{{ item }}</v-tab>
      </v-tabs>
      <v-tabs-items v-model="tab">
        <v-tab-item>
          <v-card flat>
            <ZonePeopleView
              :people="people"
              :loading="loading"
              @trace="tracePerson"
              @refresh="refreshPeople"
              />
          </v-card>
        </v-tab-item>
        <v-tab-item>
          <v-card flat>
            <ZoneAlertView
            :alerts="zoneAlerts"
            :loading="loading"
            @dismiss-alert="dismissAlert"
            @refresh="refreshAlerts"
            />
          </v-card>
        </v-tab-item>
      </v-tabs-items>
    </v-card>
  </v-dialog>
</template>

<script>
import _ from 'lodash'

import api, { ALERT_TYPES } from '@/api'
import ZonePeopleView from './ZonePeopleView.vue'
import ZoneAlertView from './ZoneAlertView.vue'

const TABS = ['People', 'Alerts']
export default {
  components: {
    ZonePeopleView, ZoneAlertView
  },

  model: {
    prop: 'dialog',
    event: 'change'
  },

  props: {
    zone: Object,
    dialog: Boolean
  },
  data: () => ({
    tabItems: TABS,
    tab: 0,
    loading: false,
    people: [],
    zoneAlerts: [],

    alert: false,
    alertType: 'error',
    alertMessage: null
  }),

  watch: {
    zone () {
      this.refreshPeople()
      this.refreshAlerts()
    }
  },

  computed: {
    availableAlerts () {
      const alerts = {
        alertOverstay: false,
        alertUnknown: false,
        alertUnauthorized: false
      }

      this.zoneAlerts.forEach(alert => {
        if (alerts.alertOverstay && alerts.alertUnknown && alerts.alertUnauthorized) {
          return // all alerts are up
        }
        if (alert.is_known) {
          return // skip dismissed alerts
        }

        switch (alert.type) {
          case ALERT_TYPES.UNKNOWN:
            alerts.alertUnknown = true
            break
          case ALERT_TYPES.UNAUTHORIZED:
            alerts.alertUnauthorized = true
            break
          case ALERT_TYPES.OVERSTAY:
            alerts.alertOverstay = true
            break
        }
      })
      return alerts
    }
  },

  methods: {
    closeDialog () {
      this.$emit('change', false)
    },
    handleDialog (val) {
      this.$emit('change', val)
    },

    tracePerson (personId) {
      // TODO
      this.showAlert('info', 'TODO Trace ' + personId)
    },

    refreshPeople () {
      if (this.loading) {
        return
      }

      const vm = this
      vm.loading = true
      const zone = vm.zone
      api.getPeopleForZone(zone.id)
        .then(people => {
          vm.people = people
          vm.loading = false

          vm.$emit('people-updated', {
            zone: zone.id,
            peopleCount: people.count
          })
        })
    },

    showAlert (type, message) {
      this.alertType = type
      this.alertMessage = message
      this.alert = true
    },

    refreshAlerts () {
      if (this.loading) {
        return
      }

      const vm = this
      vm.loading = true
      const zone = vm.zone
      api.getAlertsForZone(zone.id)
        .then(alerts => {
          vm.loading = false
          vm.zoneAlerts = alerts

          // update people, in case there's new alert for them.
          const updatedPeople = {}
          alerts.forEach(alert => {
            if (_.has(updatedPeople, alert.person.id)) {
              const existingAlerts = updatedPeople[alert.person.id].alerts
              if (!existingAlerts.includes(alert.type)) {
                existingAlerts.push(alert.type)
              }
            } else {
              updatedPeople[alert.person.id] = {
                ...alert.person,
                alerts: [alert.type]
              }
            }
          })

          Object.values(updatedPeople).forEach(person => {
            const existingPersonIndex = vm.people.findIndex(existingPerson => existingPerson.id === person.id)
            if (existingPersonIndex !== -1) {
              const existingPerson = vm.people[existingPersonIndex]
              existingPerson.alerts = _.union(existingPerson.alerts, person.alerts)
              vm.$set(vm.people, existingPersonIndex, existingPerson)
            } else {
              vm.people.push(person)
            }
          })
          vm.$nextTick(() => {
            vm.$emit('alerts-updated', {
              zone: zone.id,
              ...vm.availableAlerts
            })
            vm.$emit('people-updated', {
              zone: zone.id,
              peopleCount: vm.people.length
            })
          })
        })
        .catch(err => {
          vm.loading = false

          let message
          if (_.isPlainObject(err)) {
            if (_.has(err, 'message')) {
              message = err.message
            }
          } else {
            message = err
          }
          vm.showAlert('error', message)
        })
    },

    dismissAlert (alertId) {
      const index = this.zoneAlerts.findIndex(alert => alert.id === alertId)
      if (index !== -1) {
        const alert = this.zoneAlerts[index]
        alert.is_known = true
        this.$set(this.zoneAlerts, index, alert)
      }
      this.$emit('alerts-updated', {
        zone: this.zone.id,
        ...this.availableAlerts
      })
    }
  }
}
</script>
