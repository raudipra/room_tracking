<template>
  <v-app id="inspire">
    <v-navigation-drawer
      v-model="drawer"
      app
    >
      <v-list dense>
        <v-list-item
          v-for="item in drawerItems"
          :key="item.link"
          :to="item.link"
          link>
          <v-list-item-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{ item.text }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar
      app
      color="indigo"
      dark
    >
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>Application</v-toolbar-title>
    </v-app-bar>

    <v-content>
      <v-container fill-height fluid>
        <router-view/>
      </v-container>
    </v-content>
    <v-footer
      color="indigo"
      app
    >
      <span class="white--text">&copy; 2020</span>
    </v-footer>
  </v-app>
</template>

<script>

export default {
  name: 'App',
  props: {
    source: String
  },
  data: () => ({
    drawer: null,
    drawerItems: [
      { icon: 'mdi-speedometer', text: 'Dashboard', link: '/dashboard' },
      { icon: 'mdi-file-chart', text: 'Daily Report', link: '/daily-report' },
      { icon: 'mdi-file-chart', text: 'People Chart', link: '/daily-people-chart' }
    ]
  })
}
</script>
