const config = require('../config.json')

const startVlineMailServer = require('./health-check/vline')

if (!config.devMode) {
  startVlineMailServer()
}
