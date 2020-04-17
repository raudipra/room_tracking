<template>
  <v-app>
    <v-content>
      <v-container fill-height fluid>
        <v-tabs
          v-model="activeZoneGroup"
          grow
          show-arrows>
          <v-tabs-slider />

          <v-tab
            v-for="group in zoneGroups"
            :key="group.id">
            {{ group.name }}
          </v-tab>
          <v-tabs-items v-model="activeZoneGroup">
            <v-tab-item v-for="group in zoneGroups" :key="group.id">
              <v-row class="mb-6">
                <v-col class="text-center">
                  <img :src="BASE_URL + group.layout" v-if="group.layout !== null"/>
                  <img src="https://via.placeholder.com/728x90?Text=placeholder" v-else/>
                </v-col>
              </v-row>
              <v-row>
                <v-col
                  v-for="zone in group.zones"
                  :key="zone.id"
                  :lg="4"
                  :md="6"
                  :sm="12">
                  <ZoneButton
                    @click="openZoneDialog(zone)"
                    :name="zone.name"
                    :people-count="zone.persons_count"
                    :alert-unauthorized="zone.alertUnauthorized"
                    :alert-unknown-person="zone.alertUnknownPerson"
                    :alert-overstay="zone.alertOverstay"/>
                </v-col>
              </v-row>
            </v-tab-item>
          </v-tabs-items>
        </v-tabs>
        <ZoneDialog
          v-model="dialog"
          :zone="activeZone"
          @people-updated="handlePeopleUpdated"
          @alerts-updated="handleAlertsUpdated"
          />
      </v-container>
    </v-content>
  </v-app>
</template>

<script>
import _ from 'lodash'
import api, { ALERT_TYPES } from '@/api'
import ZoneButton from './components/ZoneButton'
import ZoneDialog from './components/ZoneDialog'

export default {
  name: 'Dashboard',

  data () {
    return {
      BASE_URL: api.BASE_URL,
      zoneGroups: [],
      activeZoneGroup: null,
      activeZone: null,
      dialog: false,
      isLoading: false
    }
  },

  components: { ZoneButton, ZoneDialog },

  methods: {
    openZoneDialog (zone) {
      this.activeZone = zone
      this.dialog = true
    },

    handlePeopleUpdated ({ zone, peopleCount }) {
      const vm = this
      const activeZoneGroupIdx = this.activeZoneGroup
      if (_.isUndefined(activeZoneGroupIdx) || _.isNull(activeZoneGroupIdx)) {
        console.error(`Unknown active ZoneGroup id: ${vm.activeZoneGroup.id || 'N/A'}!`)
        return
      }
      const activeZoneGroup = vm.zoneGroups[activeZoneGroupIdx]

      const currentZoneIdx = activeZoneGroup.zones.findIndex(z => z.id === zone)
      if (currentZoneIdx !== -1) {
        const currentZone = activeZoneGroup.zones[currentZoneIdx]
        currentZone.peopleCount = peopleCount
        activeZoneGroup.zones[currentZoneIdx] = currentZone

        this.$set(this.zoneGroups, activeZoneGroupIdx, activeZoneGroup)
      }
    },

    handleAlertsUpdated ({ zone, alerts }) {
      const vm = this
      const activeZoneGroupIdx = this.zoneGroups.findIndex(zg => zg.id === vm.activeZoneGroup.id)
      if (activeZoneGroupIdx === -1) {
        console.error(`Unknown active ZoneGroup id: ${vm.activeZoneGroup.id || 'N/A'}!`)
        return
      }
      const activeZoneGroup = vm.zoneGroups[activeZoneGroupIdx]

      const currentZoneIdx = activeZoneGroup.zones.findIndex(z => z.id === zone)
      if (currentZoneIdx !== -1) {
        const currentZone = activeZoneGroup.zones[currentZoneIdx]
        currentZone.alertUnknownPerson = alerts.alertUnknownPerson
        currentZone.alertOverstay = alerts.alertOverstay
        currentZone.alertUnauthorized = alerts.alertUnauthorized
        activeZoneGroup.zones[currentZoneIdx] = currentZone

        this.$set(this.zoneGroups, activeZoneGroupIdx, activeZoneGroup)
      }
    },

    refreshZones () {
      if (this.isLoading) {
        return
      }
      const vm = this
      vm.isLoading = true
      api.getZones()
        .then(zoneGroups => {
          zoneGroups.map(zoneGroup => {
            zoneGroup.zones = zoneGroup.zones.map(zone => {
              const alerts = zone.alerts
              Object.values(ALERT_TYPES).forEach(alertType => {
                const val = _.has(alerts, alertType) ? alerts[alertType] : false
                switch (alertType) {
                  case ALERT_TYPES.UNKNOWN:
                    zone.alertUnknownPerson = val
                    break
                  case ALERT_TYPES.UNAUTHORIZED:
                    zone.alertUnauthorized = val
                    break
                  case ALERT_TYPES.OVERSTAY:
                    zone.alertOverstay = val
                    break
                }
              })

              delete zone.alerts
              return zone
            })
            return zoneGroup
          })
          return zoneGroups
        })
        .then(zoneGroups => {
          vm.zoneGroups = zoneGroups
          vm.isLoading = false
        })
        .catch(err => {
          vm.isLoading = false
          console.error(err)
        })
    }
  },

  mounted () {
    this.refreshZones()
  }
}
</script>
