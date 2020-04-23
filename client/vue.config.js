module.exports = {
  transpileDependencies: [
    'quasar'
  ],

  pages: {
    dashboard: {
      entry: 'src/pages/dashboard/index.js',
      template: 'public/index.html',
      filename: 'dashboard.html',
      title: 'Dashboard'
    },
    zonePeopleHistorical: {
      entry: 'src/pages/zone-people-historical/index.js',
      template: 'public/quasar.html',
      filename: 'zone-people-historical.html',
      title: 'Historical Report'
    },
    zonePeopleHourlyCount: {
      entry: 'src/pages/zone-people-hourly-count/index.js',
      template: 'public/index.html',
      filename: 'zone-people-hourly-count.html',
      title: 'Hourly People Count Report'
    },
    zoneSettings: {
      entry: 'src/pages/zone-settings/index.js',
      template: 'public/index.html',
      filename: 'zone-settings.html',
      title: 'Zone Settings'
    }
  },

  pluginOptions: {
    quasar: {
      importStrategy: 'kebab',
      rtlSupport: false
    }
  }
}
