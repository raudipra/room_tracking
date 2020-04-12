<template>
  <v-dialog
    :value="dialog"
    @input="handleInput">
    <v-card>
      <v-img :src="src"/>
    </v-card>
  </v-dialog>
</template>

<script>
import api from '@/api'

export default {
  props: ['url', 'dialog'],

  computed: {
    src () {
      return (this.url && this.url.startsWith('http') ? this.url : `${api.BASE_URL}${this.url}`) || '@/assets/no-image.jpg'
    }
  },
  methods: {
    handleInput (val) {
      this.$emit('input', val)
    }
  }
}
</script>
