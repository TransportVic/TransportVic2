const utils = require('../utils')
const config = require('../config.json')
const modules = require('../modules.json')

module.exports = async (type, text) => {
  if (modules.discordIntegration && modules.discordIntegration[type]) {
    await utils.request(config.discordURLs[type], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: text
      })
    })
  }
}
