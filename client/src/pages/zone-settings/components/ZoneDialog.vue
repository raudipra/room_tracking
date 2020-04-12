<template>
  <v-dialog
    :value="dialog"
    @input="handleInput">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-alert v-if="error !== null"
        dense
        dismissible
        type="error"
        @input="handleErrorDismissed">
        {{ error }}
      </v-alert>
      <v-card-text>
        <v-form v-model="valid" ref="form" lazy-validation>
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-text-field :value="zoneGroupName" label="Zone Group" readonly/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="currentZone.name"
                  label="Name"
                  :disabled="isLoading"
                  required
                  :counter="255"
                  :rules="nameRules"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-switch v-model="currentZone.is_active" label="Active" :disabled="isLoading"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-text-field v-model="currentZone.description" label="Description" :disabled="isLoading"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="currentZone.overstay_limit"
                  label="Overstay Limit"
                  :disabled="isLoading"
                  :rules="overstayLimitRules"
                  required
                />
              </v-col>
            </v-row>
          </v-container>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="close" :disabled="isLoading">Cancel</v-btn>
        <v-btn color="blue darken-1" text @click="save" :loading="isLoading" :disabled="!valid">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import api from '@/api'
import _ from 'lodash'

const EMPTY_ZONE = {
  id: null,
  name: '',
  description: '',
  is_active: true,
  overstay_limit: '00:00',
  zone_group_id: null
}

export default {
  props: {
    dialog: {
      type: Boolean,
      required: true
    },
    zone: {
      required: true
    },
    zoneGroup: {
      required: true
    }
  },

  computed: {
    isEdit () {
      return _.has(this.zone, 'id') && !_.isNull(this.zone.id)
    },
    title () {
      return this.isEdit ? 'Edit Zone' : 'Create Zone'
    },
    zoneGroupName () {
      return _.isNull(this.zoneGroup) ? 'N/A' : this.zoneGroup.name
    }
  },

  data () {
    return {
      currentZone: _.cloneDeep(EMPTY_ZONE),
      isLoading: false,
      error: null,

      valid: true,
      nameRules: [
        v => !!v || 'Name is required.',
        v => (v && v.length <= 255) || 'Name must be less than 255 characters.'
      ],
      overstayLimitRules: [
        v => !!v || 'Overstay Limit is required.',
        v => /^[0-9][0-9]:[0-5][0-9]$/.test(v) || 'Overstay Limit should be in HH:MM format.'
      ]
    }
  },

  watch: {
    zone (val) {
      let newZone = val
      if (_.isNull(newZone)) {
        this.currentZone = _.cloneDeep(EMPTY_ZONE)
      } else {
        // `config` needs to be flat-mapped. assumption: no key is overriding the parent key.
        newZone = _.cloneDeep(val)
        Object.keys(newZone.config).forEach(key => {
          newZone[key] = newZone.config[key]
        })
        delete newZone.config
        console.debug(newZone)
        this.currentZone = newZone
      }
      this.error = null
    },
    zoneGroup (val) {
      if (!_.isNull(val) && !_.isUndefined(val)) {
        if (this.currentZone.id === null) {
          this.$set(this.currentZone, 'overstay_limit', val.config.default_overstay_limit)
        }
      }
    }
  },

  methods: {
    handleInput (val) {
      this.$emit('input', val)
    },
    close () {
      this.handleInput(false)
      this.error = null
      this.$refs.form.reset()
      this.$refs.form.resetValidation()
    },
    save () {
      if (!this.$refs.form.validate()) {
        return
      }

      if (this.isLoading) {
        return
      }

      this.$set(this.currentZone, 'zone_group_id', this.zoneGroup.id)

      const vm = this
      vm.isLoading = true
      const apiPromise = vm.isEdit ? api.editZone(vm.currentZone.id, vm.currentZone) : api.createZone(vm.currentZone)
      apiPromise.then(zone => {
        vm.isLoading = false
        vm.$emit('updated', zone)
      })
        .catch(err => {
          vm.isLoading = false
          const message = api.handleApiError(err)
          vm.error = message
        })
    },
    handleErrorDismissed (val) {
      if (!val) {
        this.error = null
      }
    }
  }
}
</script>
