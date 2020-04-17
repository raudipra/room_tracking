<script>
import { Line } from 'vue-chartjs'

export default {
  extends: Line,
  props: ['chartdata', 'options'],

  mounted () {
    this.renderChart(this.chartdata, this.options)
  },

  watch: {
    chartdata (val) {
      this.renderChart(val, this.options)
    }
  }
}
</script>
