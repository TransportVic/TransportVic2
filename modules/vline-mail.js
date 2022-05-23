const modules = require('../modules')

if (modules.vlineMail) {
  require('./vline-mail/index')()
}
