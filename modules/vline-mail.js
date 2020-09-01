const modules = require('../modules.json')

if (modules.vlineMail) {
  require('./vline-mail/index')()
}
