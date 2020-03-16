<template>
  <div class="text-center">
    <v-row class="mb-6" align="center" justify="center" no-gutters>
      <v-col
        cols="12">
          <img :src="layoutSrc" />
      </v-col>
    </v-row>
    <v-row class="mb-6" no-gutters align="center" justify="center" align-content="center">
      <v-col cols="4" md="4" xs="12" sm="12" v-for="zone in zones" :key="zone.id">
        <ZoneButton
          :name="zone.name"
          :people-count="zone.peopleCount"
          :alert-room-active="zone.alertRoomActive"
          :alert-unknown-person="zone.alertUnknownPerson"
          :alert-overstay="zone.alertOverstay"/>
      </v-col>
    </v-row>
  </div>
</template>

<script>
// @ is an alias to /src
import ZoneButton from '@/components/ZoneButton'

export default {
  name: 'Home',

  data () {
    return {
      layoutSrc: 'https://via.placeholder.com/450/300?text=Room+Layout',
      zones: [
        { id: 1, name: 'VeryLongZone1', peopleCount: 10, alertRoomActive: false, alertUnknownPerson: true, alertOverstay: false },
        { id: 2, name: 'Room2', peopleCount: 5, alertRoomActive: false, alertUnknownPerson: false, alertOverstay: true },
        { id: 2, name: 'Room3', peopleCount: 2, alertRoomActive: true, alertUnknownPerson: false, alertOverstay: false }
      ]
    }
  },

  components: {
    ZoneButton
  }
}
</script>
