const fs = require('fs')
const path = require('path')
const utils = require('./utils')

function getTimestamp() {
  return utils.now().format()
}

module.exports = class Logger {
  constructor(outputFile, name) {
    let folderName = path.dirname(outputFile)
    fs.mkdirSync(folderName, { recursive: true })

    this.stream = fs.createWriteStream(outputFile, { flags: 'a' })
    this.name = name
  }

  format(text) {
    return `[${this.name}] [${getTimestamp()}]: ${text}\n`
  }

  level(level, objects) {
    let text = objects.join(' ')
    this.stream.write(`${level} ${this.format(text)}`)
  }

  log(...objects) { this.level('LOG', objects) }
  info(...objects) { this.level('INFO', objects) }
  err(...objects) { this.level('ERROR', objects) }
}
