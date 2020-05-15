<template>
  <v-data-table
    :loading="loading"
    :headers="headers"
    :items="alerts">
    <template v-slot:top>
      <v-toolbar flat>
        <v-spacer/>
        <v-btn color="primary" class="mb-2" @click="refreshData" :loading="loading" :disabled="loading">Refresh</v-btn>
      </v-toolbar>
    </template>
    <template v-slot:item.avatar="{ item }">
      <v-avatar size="48">
        <v-img v-if="item.person.avatar !== null" :src="item.person.avatar"/>
        <v-img v-else src="/avatar-placeholder.png" />
      </v-avatar>
    </template>
    <template v-slot:item.name="{ item }">
      <span v-if="item.person.name">{{ item.person.name }}</span>
      <span v-else>UNKNOWN</span>
    </template>
    <template v-slot:item.from="{ item }">
      <span>{{ (new Date(item.person.from)).toLocaleString('en-US', dateTimeFormatOptions) }}</span>
    </template>
    <template v-slot:item.type="{ item }">
      <span :class="alertClass(item.type)">{{ alertLabel(item.type) }}</span>
    </template>
    <template v-slot:item.actions="{ item }">
      <v-btn v-if="!item.is_known" small color="amber" @click="dismissAlert(item.id)" :disabled="loading">Selesaikan</v-btn>
      <v-btn v-if="item.is_known" small color="primary" disabled><v-icon small>mdi-check</v-icon> Selesai</v-btn>
    </template>
  </v-data-table>
</template>

<script>
import api, { ALERT_TYPES, getAlertLabel } from '@/api'
import { DATE_TIME_FORMAT } from '@/common/date-time'

const headers = [
  { text: 'ID', value: 'id' },
  { text: 'Foto', value: 'avatar', sortable: false },
  { text: 'Nama', value: 'name' },
  { text: 'Waktu Masuk', value: 'from' },
  { text: 'Keterangan', value: 'type' },
  { text: 'Aksi', value: 'actions', sortable: false }
]
export default {
  name: 'ZoneAlertView',
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    alerts: {
      type: Array,
      required: true
    }
  },

  data: () => ({
    headers,
    dateTimeFormatOptions: DATE_TIME_FORMAT
  }),

  methods: {
    dismissAlert (alertId) {
      api.dismissAlert(alertId)
        .then(() => {
          this.$emit('dismiss-alert', alertId)
        })
    },
    refreshData () {
      this.$emit('refresh')
    },
    alertLabel (alert) {
      return getAlertLabel(alert)
    },
    alertClass (alert) {
      switch (alert) {
        case ALERT_TYPES.UNKNOWN:
          return 'red--text'
        case ALERT_TYPES.UNAUTHORIZED:
          return 'red--text'
        case ALERT_TYPES.OVERSTAY:
          return 'yellow--text text--darken-1'
        default:
          return ''
      }
    }
  }
}
</script>
