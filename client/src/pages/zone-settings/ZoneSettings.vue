<template>
  <v-app>
    <v-content>
      <v-container fluid fill-height>
        <v-row>
          <v-col col="12">
            <ZoneTable
              @create-zone="createZone"
              @edit-zone="editZone"/>
          </v-col>
        </v-row>
      </v-container>
    </v-content>
    <ZoneDialog />
  </v-app>
</template>

<script>
import ZoneDialog from './components/ZoneDialog.vue'
import ZoneTable from './components/ZoneTable.vue'

export default {
  components: { ZoneDialog, ZoneTable },

  data () {
    return {
      activeZone: null,
      dialog: false
    }
  },

  methods: {
    createZoneGroup () {

    },

    editZoneGroup (zoneGroup) {

    },

    createZone () {

    },
    editZone (zone) {

    }
  }
}
</script>
