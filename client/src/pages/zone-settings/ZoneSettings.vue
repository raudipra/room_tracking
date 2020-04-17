<template>
  <v-app>
    <v-content>
      <v-container fluid>
        <v-row>
          <v-col col="12">
            <v-toolbar dense>
              <v-toolbar-title>Zones</v-toolbar-title>
              <v-spacer/>
              <v-btn
                :disabled="isLoading"
                color="primary"
                @click="refresh"
                text
              >
                Refresh
                <v-icon right>mdi-refresh</v-icon>
              </v-btn>
              <v-btn
                :disabled="isLoading"
                color="secondary"
                @click="createZoneGroup"
                text
              >
                Create Zone Group
                <v-icon right>mdi-plus</v-icon>
              </v-btn>
            </v-toolbar>
          </v-col>
        </v-row>
        <v-row v-if="error !== null">
          <v-col col="12">
            <v-alert
              dense
              dismissible
              type="error"
              @input="handleErrorDismissed">
              {{ error }}
            </v-alert>
          </v-col>
        </v-row>
        <v-row>
          <v-col col="12">
            <ZoneTable
              :zone-groups="zoneGroups"
              :controls-enabled="!isLoading"
              :loading="isLoading"
              @open-layout-image="openImageDialog"
              @create-zone="createZone"
              @edit-zone-group="editZoneGroup"
              @edit-zone="editZone"/>
          </v-col>
        </v-row>
      </v-container>
    <ZoneDialog
      :zoneGroup="activeZoneGroup"
      :zone="activeZone"
      :dialog="zoneDialog"
      @updated="handleZoneUpdated"
      @input="zoneDialog = $event"
      />
    <ZoneGroupDialog
      :zoneGroup="activeZoneGroup"
      :dialog="zoneGroupDialog"
      @updated="handleZoneGroupUpdated"
      @input="zoneGroupDialog = $event"
      />
    <ImageDialog
      :dialog="imageDialog"
      :url="activeImageUrl"
      @input="imageDialog = $event"
      />
    </v-content>
  </v-app>
</template>

<script>
import api from '@/api'

import ZoneDialog from './components/ZoneDialog.vue'
import ZoneGroupDialog from './components/ZoneGroupDialog.vue'
import ZoneTable from './components/ZoneTable.vue'
import ImageDialog from './components/ImageDialog.vue'

export default {
  components: { ZoneDialog, ZoneGroupDialog, ZoneTable, ImageDialog },

  data () {
    return {
      zoneGroups: [],
      activeZone: null,
      activeZoneGroup: null,

      error: null,
      zoneDialog: false,
      zoneGroupDialog: false,
      isLoading: false,

      activeImageUrl: '',
      imageDialog: false
    }
  },

  watch: {
    zoneDialog (val) {
      if (!val) {
        this.activeZone = null
        this.activeZoneGroup = null
      }
    },
    zoneGroupDialog (val) {
      if (!val) {
        this.activeZoneGroup = null
      }
    }
  },

  mounted () {
    this.refresh()
  },

  methods: {
    refresh () {
      if (this.isLoading) {
        return
      }
      this.isLoading = true
      const vm = this
      api.getAllZones()
        .then(result => {
          vm.isLoading = false
          vm.zoneGroups = result
        })
        .catch(err => {
          vm.isLoading = false
          const message = api.handleApiError(err)
          vm.error = message
        })
    },
    openImageDialog (url) {
      this.activeImageUrl = url
      this.imageDialog = true
    },

    createZoneGroup () {
      this.activeZoneGroup = null
      this.zoneGroupDialog = true
    },

    editZoneGroup (zoneGroup) {
      this.activeZoneGroup = zoneGroup
      this.zoneGroupDialog = true
    },

    createZone (zoneGroup) {
      this.activeZoneGroup = zoneGroup
      this.activeZone = null
      this.zoneDialog = true
    },

    editZone (zoneGroup, zone) {
      this.activeZoneGroup = zoneGroup
      this.activeZone = zone
      this.zoneDialog = true
    },

    handleZoneUpdated (zone) {
      const zoneGroupIndex = this.zoneGroups.findIndex(zg => zg.id === zone.zone_group_id)
      if (zoneGroupIndex === -1) {
        this.error = `Cannot find zoneGroup with id ${zone.zone_group_id} in collection! Please refresh data.`
        return
      }
      const zoneGroup = this.zoneGroups[zoneGroupIndex]
      const zoneIndex = zoneGroup.zones.findIndex(z => z.id === zone.id)

      if (zoneIndex !== -1) {
        zoneGroup.zones[zoneIndex] = zone
      } else {
        zoneGroup.zones.push(zone)
      }
      this.$set(this.zoneGroups, zoneGroupIndex, zoneGroup)
      this.zoneDialog = false
      this.activeZone = null
      this.activeZoneGroup = null
    },

    handleZoneGroupUpdated (zoneGroup) {
      const idx = this.zoneGroups.findIndex(zg => zg.id === zoneGroup.id)
      if (idx !== -1) {
        // this assumes that when zoneGroup is updated in the API, all of the zones inside it is included in the response.
        this.$set(this.zoneGroups, idx, zoneGroup)
      } else {
        this.zoneGroups.push(zoneGroup)
      }
      this.zoneGroupDialog = false
      this.activeZoneGroup = null
    },
    handleErrorDismissed (val) {
      if (!val) {
        this.error = null
      }
    }
  }
}
</script>
