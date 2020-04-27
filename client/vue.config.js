module.exports = {
  publicPath: process.env.NODE_ENV === 'production' ? '/static/dist/' : '/', // adjust with the static URL of the flask folder
  outputDir: '../flask/web/static/dist',

  transpileDependencies: ['quasar', 'vuetify'],

  pages: {
    dashboard: {
      entry: 'src/pages/dashboard/index.js',
      template: 'public/index.html',
      filename: 'dashboard.html',
      title: 'Dashboard',
      chunks: ['chunk-vendors', 'chunk-common', 'chunk-dashboard-vendors', 'dashboard']
    },
    zonePeopleHistorical: {
      entry: 'src/pages/zone-people-historical/index.js',
      template: 'public/quasar.html',
      filename: 'zone-people-historical.html',
      title: 'Historical Report',
      chunks: ['chunk-vendors', 'chunk-common', 'chunk-zonePeopleHistorical-vendors', 'zonePeopleHistorical']
    },
    zonePeopleHourlyCount: {
      entry: 'src/pages/zone-people-hourly-count/index.js',
      template: 'public/index.html',
      filename: 'zone-people-hourly-count.html',
      title: 'Hourly People Count Report',
      chunks: ['chunk-vendors', 'chunk-common', 'chunk-zonePeopleHourlyCount-vendors', 'zonePeopleHourlyCount']
    },
    zoneSettings: {
      entry: 'src/pages/zone-settings/index.js',
      template: 'public/index.html',
      filename: 'zone-settings.html',
      title: 'Zone Settings',
      chunks: ['chunk-vendors', 'chunk-common', 'chunk-zoneSettings-vendors', 'zoneSettings']
    }
  },

  pluginOptions: {
    quasar: {
      importStrategy: 'kebab',
      rtlSupport: false
    }
  },
  chainWebpack: config => {
    const options = module.exports
    const pages = options.pages
    const pageKeys = Object.keys(pages)

    // Long-term caching

    const IS_VENDOR = /[\\/]node_modules[\\/]/
    config.optimization
      .splitChunks({
        cacheGroups: {
          vendors: {
            name: 'chunk-vendors',
            priority: -10,
            chunks: 'initial',
            minChunks: 2,
            test: IS_VENDOR,
            enforce: true
          },
          ...pageKeys.map(key => ({
            name: `chunk-${key}-vendors`,
            priority: -11,
            chunks: chunk => chunk.name === key,
            test: IS_VENDOR,
            enforce: true
          })),
          common: {
            name: 'chunk-common',
            priority: -20,
            chunks: 'initial',
            minChunks: 2,
            reuseExistingChunk: true,
            enforce: true
          }
        }
      })
  }
}
