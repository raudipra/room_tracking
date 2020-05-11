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
                <v-text-field
                  v-model="currentZoneGroup.name"
                  :rules="nameRules"
                  label="Name"
                  :disabled="isLoading"
                  required
                  :counter="255"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-text-field v-model="currentZoneGroup.description" label="Description" :disabled="isLoading"/>
              </v-col>
            </v-row>
            <v-row v-if="isEdit">
              <v-col cols="12">
                <v-switch v-model="replaceLayout" label="Replace Layout Image" :disabled="isLoading"/>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-file-input
                  v-model="currentZoneGroup.layout"
                  label="Layout"
                  :disabled="!replaceLayout || isLoading"
                  :required="replaceLayout"
                  prepend-icon="mdi-image"
                  accept="image/x-png,image/jpeg"
                  :rules="layoutRules"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="currentZoneGroup.config.default_overstay_limit"
                  label="Default Overstay Limit"
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
import _ from 'lodash'
import api from '@/api'

const EMPTY_ZONE_GROUP = {
  id: null,
  name: '',
  description: '',
  layout: null,
  config: {
    default_overstay_limit: '00:00'
  }
}

export default {
  props: {
    dialog: {
      type: Boolean,
      required: true
    },
    zoneGroup: {
      required: true
    }
  },

  computed: {
    isEdit () {
      return _.has(this.zoneGroup, 'id') && !_.isNull(this.zoneGroup.id)
    },
    title () {
      return this.isEdit ? 'Edit Zone Group' : 'Create Zone Group'
    },
    layoutRules () {
      return this.replaceLayout ? [
        v => !!v || 'Layout is required.'
      ] : []
    }
  },

  data () {
    return {
      currentZoneGroup: _.cloneDeep(EMPTY_ZONE_GROUP),
      isLoading: false,
      error: null,
      replaceLayout: true,

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
    zoneGroup (val) {
      let newZoneGroup = val
      if (_.isNull(newZoneGroup)) {
        this.currentZoneGroup = _.cloneDeep(EMPTY_ZONE_GROUP)
      } else {
        newZoneGroup = _.cloneDeep(val)
        // `config` needs to be flat-mapped. assumption: no key is overriding the parent key.
        Object.keys(newZoneGroup.config).forEach(key => {
          newZoneGroup[key] = newZoneGroup.config[key]
        })
        delete newZoneGroup.config
        this.currentZoneGroup = newZoneGroup
      }
      this.replaceLayout = this.currentZoneGroup.id === null
      this.error = null
    },
    replaceLayout (val) {
      if (val === false) {
        this.$set(this.currentZoneGroup, 'layout', null)
      }
    }
  },

  methods: {
    handleInput (val) {
      this.$emit('input', val)
    },
    close () {
      this.handleInput(false)
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

      const vm = this
      // conversion needed, since we may upload a file
      const data = new FormData()
      const zoneGroupData = vm.currentZoneGroup
      if (zoneGroupData.id !== null) {
        data.append('id', zoneGroupData.id)
      }
      data.append('name', zoneGroupData.name)
      data.append('description', zoneGroupData.description)
      data.append('is_active', zoneGroupData.is_active ? '1' : '0')
      if (zoneGroupData.layout) {
        data.append('layout', zoneGroupData.layout)
      }
      data.append('config', JSON.stringify(zoneGroupData.config))

      vm.isLoading = true
      const apiPromise = vm.isEdit ? api.editZoneGroup(vm.currentZoneGroup.id, data) : api.createZoneGroup(data)
      apiPromise.then(zoneGroup => {
        vm.isLoading = false
        vm.$emit('updated', zoneGroup)
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
    },
    openLayoutImage (url) {
      window.open(url, '_blank')
    }
  }
}
</script>
