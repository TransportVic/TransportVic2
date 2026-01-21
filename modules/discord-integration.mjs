import utils from '../utils.mjs'
import config from '../config.json' with { type: 'json' }
import modules from '../modules.json' with { type: 'json' }
import async from 'async'
import FormData from 'form-data'
import fs from 'fs'

async function postFirst(type, text, file) {
  let formData = new FormData()
  formData.append('content', text)
  if (file) {
    formData.append('file', fs.createReadStream(file))
  }

  await utils.request(config.discordURLs[type], {
    method: 'POST',
    body: formData,
    timeout: 60000
  })
}

export default async (type, text, file) => {
  if (modules.discordIntegration && modules.discordIntegration[type]) {
    let chunks = [[text]]

    if (text.length > 2000) {
      chunks = []

      let lines = text.split('\n')
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

    await postFirst(type, chunks[0].join('\n'), file)
    await async.forEachSeries(chunks.slice(1), async chunk => {
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
