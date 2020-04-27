<template>
  <q-layout view="lHh Lpr lFf">
    <q-header>
      <q-toolbar>
        <q-toolbar-title>People Historical</q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page-container>
      <q-page padding>
        <div class="row">
          <div class="col">
            <q-select
              label="Zone"
              v-model="zone"
              :disabled="isLoading"
              :loading="isZonesLoading"
              :options="zones"
              option-label="name"
              option-value="id"
              dense
              options-dense
              autofocus
              use-input
              input-debounce="0"
              @filter="zoneFilterFn">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps" v-on="scope.itemEvents">
                  <q-item-section>
                    <q-item-label overline>{{ scope.opt.name }}</q-item-label>
                    <q-item-label>Group: {{ scope.opt.group_name }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-gray">
                    No Results
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
          <div class="col">
            <q-input dense :value="formDateDisplay" label="Date" readonly>
              <template v-slot:append>
                <q-icon name="mdi-calendar" class="cursor-pointer">
                  <q-popup-proxy ref="qDateProxy" transition-show="scale" transition-hide="scale">
                    <q-date
                      v-model="date"
                      :options="date => date <= maxDate"
                      today-btn
                      mask="YYYY-MM-DD"
                      @input="() => $refs.qDateProxy.hide()"
                    />
                  </q-popup-proxy>
                </q-icon>
              </template>
              <template v-slot:after>
                <q-toggle dense v-model="wholeDay">
                  <q-tooltip>Whole Day</q-tooltip>
                </q-toggle>
              </template>
            </q-input>
          </div>
          <div class="col-1" v-if="!wholeDay">
            <q-input dense label="From" :value="fromHourDisplay" readonly>
              <template v-slot:append>
                <q-icon name="mdi-clock" class="cursor-pointer">
                  <q-popup-proxy ref="qFromHourProxy" transition-show="scale" transition-hide="scale">
                    <q-time
                      v-model="fromHour"
                      format24h
                      :options="hr => hr <= toHour"
                      @input="closeFromHourPicker"
                      :minute-options="[0]"
                    />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <div class="col-1" v-if="!wholeDay">
            <q-input dense label="To" :value="toHourDisplay" readonly>
              <template v-slot:append>
                <q-icon name="mdi-clock" class="cursor-pointer">
                  <q-popup-proxy ref="qToHourProxy" transition-show="scale" transition-hide="scale">
                    <q-time
                      v-model="toHour"
                      format24h
                      @input="closeToHourPicker"
                      :options="hr => hr >= fromHour"
                      :minute-options="[0]"
                    />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <div class="col">
            <q-btn-group push>
              <q-btn push icon="mdi-refresh" label="Get Data" size="md" :disabled="isLoading || !formValid" @click="getData" />
              <q-btn push icon="mdi-file-delimited" label="Export CSV" size="md" :disabled="exportCsvDisabled" @click="exportToCsv" />
            </q-btn-group>
          </div>
        </div>
        <div class="row">
          <div class="col">
            <q-table
              dense
              :columns="columns"
              :data="peopleRecords"
              row-key="person_id"
              :loading="isLoading">
              <template v-slot:body="props">
                <q-tr :props="props">
                  <q-td key="person_id" :props="props">
                    {{ props.row.person_id }}
                  </q-td>
                  <q-td key="avatar" :props="props">
                    <q-avatar color="indigo">
                      <img v-if="props.row.avatar !== null"
                        :src="props.row.avatar"
                        :alt="`person-${props.row.person_id}-${props.row.is_known ? props.row.person_name : 'UNKNOWN'}`"/>
                      <span v-else class="text-white headline">
                        <template v-if="props.row.is_known">{{ props.row.person_name.match(/\b(\w)/g).join('') }}</template>
                        <template v-else>U</template>
                      </span>
                    </q-avatar>
                  </q-td>
                  <q-td key="name" :props="props">
                    <span v-if="props.row.is_known">{{ props.row.person_name }}</span>
                    <span v-else class="text-red">UNKNOWN</span>
                  </q-td>
                  <q-td key="from" :props="props">
                    {{ props.row.from | formatDateTime }}
                  </q-td>
                  <q-td key="to" :props="props">
                    <span v-if="props.row.to === null">-</span>
                    <span v-else>{{ props.row.to | formatDateTime }}</span>
                  </q-td>
                </q-tr>
              </template>
            </q-table>
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
import { DateTime } from 'luxon'

import api from '@/api'
import exportCsv from '@/common/mixins/export-csv'
import dateTime from '@/common/mixins/date-time'

const columns = [
  { label: 'ID', name: 'person_id', field: 'person_id', required: true },
  { label: 'Foto', align: 'center', name: 'avatar', field: 'avatar', sortable: false },
  { label: 'Nama', align: 'left', name: 'name', field: 'person_name', sortable: true },
  {
    label: 'Waktu Masuk',
    name: 'from',
    field: 'from',
    sortable: true,
    sort: (a, b) => b - a
  },
  {
    label: 'Waktu Keluar',
    name: 'to',
    field: 'to',
    sortable: true,
    sort: (a, b) => {
      // nulls are last
      if (a === null) {
        return 1
      } else if (b === null) {
        return -1
      }
      return b - a
    }
  }
]

function formatHour (val) {
  return val < 10 ? `0${val}:00` : `${val}:00`
}

export default {
  mixins: [exportCsv, dateTime],
  data: () => {
    const now = DateTime.local().startOf('hour')

    return {
      maxDate: now.toFormat('yyyy/LL/dd'),

      wholeDay: false,

      zones: [],
      zone: null,
      isZonesLoading: false,

      date: now.toFormat('yyyy-LL-dd'),
      fromHour: now.hour,
      toHour: now.hour,

      isLoading: false,
      peopleRecords: [],
      columns
    }
  },
  computed: {
    formDateDisplay () {
      return DateTime.fromFormat(this.date, 'yyyy-LL-dd').toFormat('dd LLL yyyy')
    },
    fromHourDisplay () {
      return formatHour(this.fromHour)
    },
    toHourDisplay () {
      return formatHour(this.toHour)
    },
    exportCsvDisabled () {
      return this.isLoading || this.peopleRecords.length === 0
    },
    formValid () {
      return this.zone !== null
    }
  },

  methods: {
    closeFromHourPicker (v, details) {
      this.fromHour = details.hour
      this.$refs.qFromHourProxy.hide()
    },
    closeToHourPicker (v, details) {
      this.toHour = details.hour
      this.$refs.qToHourProxy.hide()
    },

    zoneFilterFn (val, update) {
      // Items have already been requested
      if (this.isZonesLoading) return

      this.isZonesLoading = true

      api.getZonesByName(val)
        .then(results => {
          this.isZonesLoading = false
          update(() => {
            this.zones = results
          })
        })
        .catch(err => {
          this.isZonesLoading = false
          this.showError(err.message)
        })
    },

    getData () {
      if (this.isLoading) return

      this.isLoading = true
      const vm = this

      let promise
      if (this.wholeDay) {
        promise = api.getPeopleWihtinDate(this.zone.id, this.date)
      } else {
        const tsFrom = `${this.date}T${formatHour(this.fromHour)}`
        const tsTo = `${this.date}T${formatHour(this.toHour)}`
        promise = api.getPeopleWihtinDateTimeRange(this.zone.id, tsFrom, tsTo)
      }
      promise
        .then(results => {
          vm.peopleRecords = results
          vm.isLoading = false
        })
        .catch(err => {
          vm.isLoading = false
          this.showError(err.message)
        })
    },

    exportToCsv () {
      const DATETIME_FORMAT_EXPORT = 'yyyy-MM-dd HH:mm:ss'
      const data = this.peopleRecords.map(r => [
        r.person_id,
        r.is_known ? r.person_name : 'UNKNOWN',
        DateTime.fromJSDate(r.from).toFormat(DATETIME_FORMAT_EXPORT),
        r.to !== null ? DateTime.fromJSDate(r.to).toFormat(DATETIME_FORMAT_EXPORT) : 'NULL'
      ])
      const headers = ['id', 'name', 'from', 'to']
      const date = this.date.replace(/-/g, '')
      let filename
      if (this.wholeDay) {
        filename = `${date}_zone-people-historical.csv`
      } else {
        const fromHour = this.fromHour < 10 ? `0${this.fromHour}` : `${this.fromHour}`
        const toHour = this.toHour < 10 ? `0${this.toHour}` : `${this.toHour}`
        filename = `${date}_${fromHour}${toHour}_zone-people-historical.csv`
      }

      this.exportCsv(data, headers, filename)
    },

    showError (message) {
      this.$q.notify({
        type: 'warning',
        message
      })
    }
  }
}
</script>
