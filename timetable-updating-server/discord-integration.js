const utils = require('../utils')
const config = require('../config.json')
const modules = require('../modules.json')

module.exports = async text => {
  if (modules.updaterDiscordIntegration) {
    await utils.request(config.discordUpdaterURL, {
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
