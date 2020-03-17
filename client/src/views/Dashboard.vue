<template>
  <v-row>
    <v-col xs="12">
      <v-row class="mb-6">
        <v-col class="text-center">
          <img :src="layoutSrc" />
        </v-col>
      </v-row>
      <v-row>
        <v-col
          v-for="zone in zones"
          :key="zone.id"
          :lg="4"
          :md="6"
          :sm="12">
          <ZoneButton
            @click="openZoneDialog(zone)"
            :name="zone.name"
            :people-count="zone.peopleCount"
            :alert-room-active="zone.alertRoomActive"
            :alert-unknown-person="zone.alertUnknownPerson"
            :alert-overstay="zone.alertOverstay"/>
        </v-col>
      </v-row>
    </v-col>
    <ZoneDialog
      v-model="dialog"
      :zone="activeZone"
      />
  </v-row>
</template>

<script>
// @ is an alias to /src
import ZoneButton from '@/components/ZoneButton'
import ZoneDialog from '@/components/ZoneDialog'

export default {
  name: 'Dashboard',

  data () {
    return {
      layoutSrc: 'https://via.placeholder.com/600/300?text=Room+Layout',
      zones: [
        {
          id: 1,
          name: 'VeryLongZone1',
          peopleCount: 10,
          alertRoomActive: false,
          alertUnknownPerson: true,
          alertOverstay: false
        },
        {
          id: 2,
          name: 'Room2',
          peopleCount: 5,
          alertRoomActive: false,
          alertUnknownPerson: false,
          alertOverstay: true
        },
        {
          id: 3,
          name: 'Room3',
          peopleCount: 2,
          alertRoomActive: true,
          alertUnknownPerson: false,
          alertOverstay: false
        }
      ],
      activeZone: null,
      dialog: false
    }
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
        currentZone.alertRoomActive = false

        this.$set(this.zones, currentZoneIdx, currentZone)
      }
    }
  }
}
</script>
