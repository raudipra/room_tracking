<template>
  <v-data-table
    :headers="headers"
    :items="zoneGroups"
    single-expand
    :expanded.sync="expanded"
    item-key="id"
    show-expand
    :loading="loading"
  >
    <template v-slot:expanded-item="{ headers, item }">
      <td :colspan="headers.length">
        <v-simple-table v-if="item.zones.length > 0">
          <template v-slot:default>
            <thead>
              <tr>
                <th class="text-left">Name</th>
                <th class="text-left">Active</th>
                <th class="text-left">Created At</th>
                <th class="text-left">Updated At</th>
                <th class="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="zone in item.zones" :key="zone.id">
                <td>{{ zone.name }}</td>
                <td>{{ zone.config.is_active | yesNo }}</td>
                <td>{{ zone.created_at | formatDateTime }}</td>
                <td>{{ zone.updated_at | formatDateTime }}</td>
                <td>
                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <v-icon small @click="editZone(item, zone)" v-on="on" :disabled="!controlsEnabled">mdi-pencil</v-icon>
                    </template>
                    <span>Edit Zone {{ zone.name }}</span>
                  </v-tooltip>
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
        <span v-else class="text-center">No zone defined within ZoneGroup {{ item.name }}!</span>
      </td>
    </template>
    <template v-slot:item.layout="{ item }">
      <v-btn outlined @click="openLayoutImage(item.layout)">
        View
      </v-btn>
    </template>
    <template v-slot:item.zone_count="{ item }">
      <span class="text-right">{{ item.zones.length }}</span>
    </template>
    <template v-slot:item.actions="{ item }">
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-icon small @click="createZone(item)" v-on="on" :disabled="!controlsEnabled">mdi-plus-one</v-icon>
        </template>
        <span>Create Zone in ZoneGroup {{ item.name }}</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-icon small @click="editZoneGroup(item)" v-on="on" :disabled="!controlsEnabled">mdi-pencil</v-icon>
        </template>
        <span>Edit Zone Group {{ item.name }}</span>
      </v-tooltip>
    </template>
  </v-data-table>
</template>

<script>
import DateTimeMixins from '@/common/mixins/date-time'
import YesNoMixin from '@/common/mixins/yes-no'

const headers = [
  { text: '', value: 'data-table-expand' },
  { text: 'Name', value: 'name' },
  { text: 'Layout', value: 'layout', sortable: false },
  { text: '# of Zones', value: 'zone_count', sortable: false },
  { text: 'Actions', value: 'actions', sortable: false }
]

export default {
  mixins: [DateTimeMixins, YesNoMixin],
  props: {
    zoneGroups: {
      required: true,
      type: Array
    },
    controlsEnabled: {
      required: false,
      default: true
    },
    loading: {
      required: false,
      default: false
    }
  },

  data () {
    return {
      expanded: [],
      headers
    }
  },

  methods: {
    createZone (zoneGroup) {
      this.$emit('create-zone', zoneGroup)
    },
    editZone (zoneGroup, zone) {
      this.$emit('edit-zone', zoneGroup, zone)
    },
    editZoneGroup (zoneGroup) {
      this.$emit('edit-zone-group', zoneGroup)
    },
    openLayoutImage (url) {
      this.$emit('open-layout-image', url)
    }
  }
}
</script>
