<template>
  <v-data-table
    :headers="headers"
    :items="zoneGroups"
    single-expand
    :expanded.sync="expanded"
    item-key="id"
    show-expand
  >
    <template v-slot:expanded-item="{ headers, item }">
      <td :colspan="headers.length">
        <v-simple-table>
          <template v-slot:default>
            <thead>
              <tr>
                <th class="text-left">Name</th>
                <th class="text-left">Created At</th>
                <th class="text-left">Updated At</th>
                <th class="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="zone in item.zones" :key="zone.id">
                <td>{{ zone.name }}</td>
                <td>{{ zone.created_at }}</td>
                <td>{{ zone.updated_at }}</td>
                <td>
                  <v-icon small @click="editZone(zone)">mdi-pencil</v-icon>
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </td>
    </template>
    <template v-slot:zone-count="{ item }">
      <span class="text-right">{{ item.zones.length }}</span>
    </template>
  </v-data-table>
</template>

<script>

const headers = [
  { text: '', value: 'data-table-expand' },
  { text: 'Name', value: 'name' },
  { text: 'Layout', value: 'layout', sortable: false },
  { text: '# of Zones', value: 'zone-count', sortable: false }
]

export default {
  props: {
    zoneGroups: {
      required: true,
      type: Array
    }
  },

  data () {
    return {
      expanded: [],
      headers
    }
  },

  methods: {
    createZone () {
      this.$emit('create-zone')
    },
    editZone (zone) {
      this.$emit('edit-zone', zone)
    }
  }
}
</script>
