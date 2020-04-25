function exportCsv (data, headers = [], filename = 'file.csv') {
  let downloadFilename = filename
  if (!downloadFilename.toLowerCase().endsWith('.csv')) {
    downloadFilename += '.csv'
  }
  let csvContent = 'data:text/csv;charset=utf-8,'
  if (headers.length > 0) {
    csvContent += headers.join(',') + '\n'
  }
  csvContent += data.map(e => e.join(',')).join('\n')
  const link = document.createElement('a')
  link.setAttribute('href', encodeURI(csvContent))
  link.setAttribute('download', filename)

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default {
  methods: { exportCsv }
}
