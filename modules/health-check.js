const modules = require('../modules.json')

if (modules.vlineMail) {
  require('./health-check/vline')()
}
