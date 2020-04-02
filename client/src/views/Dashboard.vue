<template>
  <v-row>
    <v-col xs="12">
      <v-tabs
        show-arrows>
        <v-tabs-slider />

        <v-tab
          v-for="group in zoneGroups"
          :key="group.id"
          :href="`#group-${group.id}`">
          {{ group.name }}
        </v-tab>
        <v-tabs-items v-model="activeZoneGroup">
          <v-tab-item>
            <v-row class="mb-6">
              <v-col class="text-center">
                <img :src="group.layout" v-if="group.layout !== null" />
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
                  :people-count="zone.peopleCount"
                  :alert-unauthorized="zone.alertUnauthorized"
                  :alert-unknown-person="zone.alertUnknownPerson"
                  :alert-overstay="zone.alertOverstay"/>
              </v-col>
            </v-row>
          </v-tab-item>
        </v-tabs-items>
      </v-tabs>
    </v-col>
    <ZoneDialog
      v-model="dialog"
      :zone="activeZone"
      />
  </v-row>
</template>

<script>
// @ is an alias to /src
import _ from 'lodash'
import api, { ALERT_TYPES } from '@/api'
import ZoneButton from '@/components/ZoneButton'
import ZoneDialog from '@/components/ZoneDialog'

export default {
  name: 'Dashboard',

  data () {
    return {
      zoneGroups: [],
      activeZoneGroup: null,
      activeZone: null,
      dialog: false,
      isLoading: false
    }
  },

  mounted () {
    this.refreshZones()
  },

  components: {
    ZoneButton, ZoneDialog
  },

  methods: {
    openZoneDialog (zone) {
      this.activeZone = zone
      this.dialog = true
    },

    handlePeopleUpdated ({ zone, peopleCount }) {
      const currentZoneIdx = this.zones.findIndex(z => z.id === zone)
      if (currentZoneIdx !== -1) {
        const currentZone = this.zones[currentZoneIdx]
        currentZone.peopleCount = peopleCount
        this.$set(this.zones, currentZoneIdx, currentZone)
      }
    },

    handleAlertsUpdated ({ zone, alerts }) {
      const currentZoneIdx = this.zones.findIndex(z => z.id === zone)
      if (currentZoneIdx !== -1) {
        const currentZone = this.zones[currentZoneIdx]
        currentZone.alertUnknownPerson = alerts.alertUnknownPerson
        currentZone.alertOverstay = alerts.alertOverstay
        currentZone.alertUnauthorized = false

        this.$set(this.zones, currentZoneIdx, currentZone)
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
  }
}
</script>
