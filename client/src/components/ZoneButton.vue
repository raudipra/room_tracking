<template>
  <div class="text-center">
    <v-btn
      x-large
      class="pt-10 pb-10 pl-10 pr-10 text-center"
      outlined
      @click="clicked">
      <p>
        <span class="subtitle-1">{{ name }}</span><br/>
        <span class="title">{{ peopleCount }}</span>
      </p>
    </v-btn>
    <br/>
    <div class="text-center">
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-icon :class="unauthorizedClass" v-on="on">
            {{ alertUnauthorized ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}
          </v-icon>
        </template>
        <span>Room should be inactive</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-icon :class="overstayClass" v-on="on">
            {{ alertOverstay ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}
          </v-icon>
        </template>
        <span>Overstay</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-icon :class="unknownPersonClass" v-on="on">
            {{ alertUnknownPerson ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}
          </v-icon>
        </template>
        <span>Unknown Person</span>
      </v-tooltip>
    </div>
  </div>
</template>

<style lang="sass" scoped>
@import '~vuetify/src/styles/styles.sass'
@import '@/styles/_mixins.scss'

// TODO move to separate file?
$default-off-state-color: map-get($blue-grey, base)
/* alerts is defined here */
$alerts: 'room-active' map-get($yellow, base), 'overstay' map-get($yellow, base), 'unknown-person' map-get($red, base)

@each $tuple in $alerts
  .alert-#{nth($tuple, 1)}
    animation: alert-#{nth($tuple, 1)}-animation 1s steps(2, start) infinite
    -webkit-animation: alert-#{nth($tuple, 1)}-animation 1s steps(2, start) infinite

  // keyframes is built-in from sass
  @include keyframes(alert-#{nth($tuple, 1)}-animation)
    from
      color: $default-off-state-color
    to
      color: nth($tuple, 2)
</style>

<script>
export default {
  props: {
    name: String,
    peopleCount: Number,
    alertUnauthorized: Boolean,
    alertUnknownPerson: Boolean,
    alertOverstay: Boolean
  },
  computed: {
    unauthorizedClass () {
      return {
        'alert-unauthorized': this.alertUnauthorized
      }
    },
    unknownPersonClass () {
      return {
        'alert-unknown-person': this.alertUnknownPerson
      }
    },
    overstayClass () {
      return {
        'alert-overstay': this.alertOverstay
      }
    }
  },
  methods: {
    clicked () {
      this.$emit('click')
    }
  }
}
</script>
