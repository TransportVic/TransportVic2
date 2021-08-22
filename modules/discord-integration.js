const utils = require('../utils')
const config = require('../config.json')
const modules = require('../modules.json')
const async = require('async')

module.exports = async (type, text) => {
  if (modules.discordIntegration && modules.discordIntegration[type]) {
    let chunks = [[text]]

    if (text.length > 2000) {
      chunks = []

      let lines = text.split('\n').filter(Boolean)
      let currentChunk = []
      let currentLength = 0
      for (let i = 0; i < lines.length; i ++) {
        let currentLine = lines[i]
        if (currentLength + currentLine.length <= 2000) {
          currentChunk.push(currentLine)
          currentLength += currentLine.length + 1
        } else {
          chunks.push(currentChunk)
          currentChunk = [currentLine]
          currentLength = currentLine.length
        }
      }
      if (currentChunk) chunks.push(currentChunk)
    }

    await async.forEachSeries(chunks, async chunk => {
      await utils.request(config.discordURLs[type], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: chunk.join('\n')
        })
      })
    })
  }
}
