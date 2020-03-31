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
            label="Zone"
            item-text="name"
            item-value="id">
            <template v-slot:item="data">
              <template v-if="typeof data.item !== 'object'">
                <v-list-item-content v-text="data.item"></v-list-item-content>
              </template>
              <template v-else>
                <v-list-item-content>
                  <v-list-item-title v-text="data.item.name" />
                  <v-list-item-subtitle v-text="`Group: ${data.item.group_name}`" />
                </v-list-item-content>
              </template>
            </template>
          </v-autocomplete>
        </v-col>
        <v-col xs="12" sm="6" md="3">
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
        <v-col xs="6" sm="3" md="2">
          <v-menu
            v-model="fromHourMenu"
            :close-on-content-click="false"
            :nudge-right="40"
            :disabled="isLoading"
            transition="scale-transition"
            offset-y
          >
            <template v-slot:activator="{ on }">
              <v-text-field
                label="From"
                prepend-icon="mdi-clock"
                readonly
                :value="fromHour"
                :disabled="isLoading"
                v-on="on"
              ></v-text-field>
            </template>
            <v-time-picker
              v-if="fromHourMenu"
              locale="en-in"
              :max="maxFromHour"
              v-model="fromHour"
              :disabled="isLoading"
              format="24hr"
              no-title
              @click:hour="closeFromHourPicker"
            ></v-time-picker>
          </v-menu>
        </v-col>
        <v-col xs="6" sm="3" md="2">
          <v-menu
            v-model="toHourMenu"
            :close-on-content-click="false"
            :nudge-right="40"
            transition="scale-transition"
            offset-y
          >
            <template v-slot:activator="{ on }">
              <v-text-field
                label="To"
                prepend-icon="mdi-clock"
                readonly
                :disabled="isLoading"
                :value="toHour"
                v-on="on"
              ></v-text-field>
            </template>
            <v-time-picker
              v-if="toHourMenu"
              locale="en-in"
              :min="minToHour"
              v-model="toHour"
              no-title
              format="24hr"
              :disabled="isLoading"
              @click:hour="closeToHourPicker"
            ></v-time-picker>
          </v-menu>
        </v-col>
        <v-col xs="6" sm="3" md="1">
          <v-btn color="primary" small @click="getData" :disabled="isLoading">Get Data</v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col col="12">
          <v-data-table
            :loading="isLoading"
            :headers="headers"
            :items="peopleRecords">
            <template v-slot:top>
              <v-toolbar flat>
                <v-spacer/>
                <v-btn color="secondary" class="mb-2" @click="refreshData" :disabled="loading">Refresh</v-btn>
              </v-toolbar>
            </template>
            <template v-slot:item.picture="{ item }">
              <v-avatar size="36px">
                <img v-if="item.picture !== null"
                  :src="item.picture"
                  alt="Avatar"/>
                <span v-else class="white--text headline">
                  <template v-if="item.is_known">{{ item.name.match(/\b(\w)/g).join('') }}</template>
                  <template v-else>U</template>
                </span>
              </v-avatar>
            </template>
            <template v-slot:item.from="{ item }">
              <span>{{ (new Date(item.from)).toLocaleString('en-US', dateTimeFormatOptions) }}</span>
            </template>
            <template v-slot:item.to="{ item }">
              <span>{{ (new Date(item.to)).toLocaleString('en-US', dateTimeFormatOptions) }}</span>
            </template>
          </v-data-table>
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>

<script>
import { DateTime } from 'luxon'

const headers = [
  { text: 'ID', value: 'id' },
  { text: 'Foto', value: 'picture', sortable: false },
  { text: 'Nama', value: 'name' },
  { text: 'Waktu Masuk', value: 'from' },
  { text: 'Waktu Keluar', value: 'to' }
]

export default {
  data: () => {
    const now = DateTime.local().startOf('hour')

    return {
      dateMenu: false,
      maxDate: now.toFormat('yyyy-LL-dd'),

      fromHourMenu: false,
      toHourMenu: false,
      wholeDay: false,

      zones: [],
      zone: null,
      zoneSearch: null,
      isZonesLoading: false,

      date: now.toFormat('yyyy-LL-dd'),
      fromHour: now.toFormat('HH:mm'),
      toHour: now.toFormat('HH:mm'),

      isLoading: false,
      peopleRecords: [],
      headers
    }
  },
  computed: {
    formDateDisplay () {
      return DateTime.fromFormat(this.date, 'yyyy-LL-dd').toFormat('dd LLL yyyy')
    },
    maxFromHour () {
      return this.toHour
    },
    minToHour () {
      return this.fromHour
    }
  },

  watch: {
    zoneSearch (val) {
      val && val !== this.selectedZone && this.queryZones(val)
    }
  },

  methods: {
    closeFromHourPicker (v) {
      v = v < 10 ? '0' + v : v
      this.fromHour = v + ':00'
      this.fromHourMenu = false
    },
    closeToHourPicker (v) {
      v = v < 10 ? '0' + v : v
      this.toHour = v + ':00'
      this.toHourMenu = false
    },

    queryZones (val) {
      if (this.isZonesLoading) return

      this.zoneLoading = true
      // TODO api call
    },

    getData () {
      // TODO api call
    }
  }
}
</script>
