<template>
  <v-data-table
    :loading="loading"
    :headers="headers"
    :items="people">
    <template v-slot:top>
      <v-toolbar flat>
        <v-spacer/>
        <v-btn color="primary" class="mb-2" @click="refreshData" :disabled="loading">Refresh</v-btn>
      </v-toolbar>
    </template>
    <template v-slot:item.name="{ item }">
      <span v-if="item.name">{{ item.name }}</span>
      <span v-else>UNKNOWN</span>
    </template>
    <template v-slot:item.from="{ item }">
      <span>{{ (new Date(item.from)).toLocaleString('en-US', dateTimeFormatOptions) }}</span>
    </template>
    <template v-slot:item.avatar="{ item }">
      <v-avatar size="48">
        <v-img v-if="item.avatar !== null" :src="item.avatar"/>
        <v-img v-else src="/avatar-placeholder.png" />
      </v-avatar>
    </template>
    <template v-slot:item.remarks="{ item }">
      <span v-if="item.alerts.length === 0">-</span>
      <template v-else>
        <template v-for="(alert, i) in item.alerts">
          <span :key="alert" :class="alertClass(alert)">{{ alertLabel(alert) }}</span>
          <span :key="i" v-if="i < item.alerts.length - 1">,&nbsp;</span>
        </template>
      </template>
    </template>
    <template v-slot:item.actions="{ item }">
      <v-btn small color="primary" @click="tracePerson(item.id)" :disabled="loading">Lacak</v-btn>
    </template>
  </v-data-table>
</template>

<script>
import { ALERT_TYPES, getAlertLabel } from '@/api'
import { DATE_TIME_FORMAT } from '@/common/date-time'

const headers = [
  { text: 'ID', value: 'id' },
  { text: 'Foto', value: 'avatar', sortable: false },
  { text: 'Nama', value: 'name' },
  { text: 'Waktu Masuk', value: 'from' },
  { text: 'Keterangan', value: 'remarks' },
  { text: 'Aksi', value: 'actions', sortable: false }
]
export default {
  name: 'ZonePeopleView',
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    people: {
      type: Array,
      required: true
    }
  },

  data: () => ({
    headers,
    dateTimeFormatOptions: DATE_TIME_FORMAT
  }),

  methods: {
    customSort (items, index, isDesc) {
      items.sort((a, b) => {
        if (index[0] === 'from') {
          const dateA = new Date(a[index])
          const dateB = new Date(b[index])
          return isDesc[0] ? dateA - dateB : dateB - dateA
        } else if (index[0] === 'remarks') {
          const alertsA = a[index]
          const alertsB = b[index]

          if (isDesc[0]) {
            if (alertsA.length > alertsB.length) {
              return -1
            }
            if (alertsA.length === alertsB.length) {
              return 0
            }
            return 1
          } else {
            if (alertsB.length > alertsA.length) {
              return -1
            }
            if (alertsB.length === alertsA.length) {
              return 0
            }
            return 1
          }
        } else if (index[0] === 'name') {
          const nameA = a[index].toUpperCase()
          const nameB = b[index].toUpperCase()

          if (isDesc[0]) {
            if (nameB < nameA) {
              return -1
            }
            if (nameB > nameA) {
              return 1
            }
            return 0
          } else {
            if (nameA < nameB) {
              return -1
            }
            if (nameA > nameB) {
              return 1
            }
            return 0
          }
        } else { // must be ID
          const idA = a[index]
          const idB = b[index]

          if (isDesc[0]) {
            if (idB < idA) {
              return -1
            }
            if (idB > idA) {
              return 1
            }
            return 0
          } else {
            if (idA < idB) {
              return -1
            }
            if (idA > idB) {
              return 1
            }
            return 0
          }
        }
      })
    },

    tracePerson (personId) {
      this.$emit('trace', personId)
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
