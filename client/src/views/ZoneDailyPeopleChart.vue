<template>
  <v-row>
    <v-col col="12">
      <v-row>
        <v-col xs="12" sm="6" md="4">
          <v-autocomplete
            v-model="zone"
            :disabled="isLoading"
            :loading="isZonesLoading"
            :items="zones"
            :search-input.sync="zoneSearch"
            cache-items
            placeholder="Start typing to Search"
            label="Zone"
            item-text="name"
            item-value="id">
            <template v-slot:item="data">
              <v-list-item-content>
                <v-list-item-title v-text="data.item.name" />
                <v-list-item-subtitle v-text="`Group: ${data.item.group_name}`" />
              </v-list-item-content>
            </template>
          </v-autocomplete>
        </v-col>
        <v-col xs="12" sm="4" md="4">
          <v-menu
            v-model="dateMenu"
            :close-on-content-click="false"
            :nudge-right="40"
            transition="scale-transition"
            offset-y
            :disabled="isLoading"
            max-width="290px"
            min-width="290px"
          >
            <template v-slot:activator="{ on }">
              <v-text-field
                label="Date"
                prepend-icon="mdi-event"
                readonly
                :disabled="isLoading"
                :value="formDateDisplay"
                v-on="on"
              ></v-text-field>
            </template>
            <v-date-picker
              locale="en-in"
              :max="maxDate"
              v-model="date"
              :disabled="isLoading"
              no-title
              @input="dateMenu = false"
            ></v-date-picker>
          </v-menu>
        </v-col>
        <v-col xs="6" sm="2" md="2">
          <v-btn color="primary" small @click="getData" :disabled="isLoading">Get Data</v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col col="12">
          <DailyPeopleChart :chartdata="chartData" :options="chartOptions" />
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>

<script>
import { DateTime } from 'luxon'

import api from '@/api'
import DailyPeopleChart from '@/components/DailyPeopleChart.vue'

export default {
  components: { DailyPeopleChart },

  data () {
    const now = DateTime.local().startOf('hour')

    return {
      maxDate: now.toFormat('yyyy-LL-dd'),
      date: now.toFormat('yyyy-LL-dd'),
      dateMenu: false,

      zones: [],
      zone: null,
      zoneSearch: null,
      isZonesLoading: false,

      isLoading: false,

      selectedZone: null,
      data: [],
      chartOptions: {
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      }
    }
  },

  computed: {
    formDateDisplay () {
      return DateTime.fromFormat(this.date, 'yyyy-LL-dd').toFormat('dd LLL yyyy')
    },

    chartData () {
      const labels = []
      const data = []
      for (let i = 0; i <= 23; i++) {
        labels.push(i)
        if (this.data.length > 0) {
          data.push(data[i])
        } else {
          data.push(0)
        }
      }

      return {
        labels,
        datasets: [{
          label: '# of people',
          data,
          borderWidth: 1
        }]
      }
    }
  },

  methods: {
    zoneSearch (zoneName) {
      // Items have already been requested
      if (this.isZonesLoading) return

      this.isZonesLoading = true
      const vm = this

      // Lazily load input items
      api.getZonesByName(zoneName)
        .then(results => {
          vm.isZonesLoading = false
          vm.results = results
        })
        .catch(err => {
          vm.isZonesLoading = false
          console.error(err)
        })
    },

    getData () {
      if (this.isLoading) {
        return
      }

      const vm = this
      const selectedZone = vm.zone
      const date = vm.date

      vm.isLoading = true
      api.getPeopleCountHourlyInZone(selectedZone, date)
        .then(result => {
          vm.data = result.map(row => row.persons_count)
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
