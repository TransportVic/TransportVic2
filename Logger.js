const fs = require('fs')
const path = require('path')
const utils = require('./utils')
let { inspect } = require('util')

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
    return `[${this.name}] [${getTimestamp()}]: ${text}`
  }

  level(level, objects) {
    let text = objects.map(object => {
      if (object instanceof Error) {
        return (object && object.stack) ? object.stack : object
      } else if (['string', 'number', 'boolean', 'undefined'].includes(typeof object)) return object
      else return inspect(object, { depth: 5 })
    }).join(' ')
    let logData = `${level} ${this.format(text)}`

    this.stream.write(logData + '\n')
    console.log(logData)
  }

  log(...objects) { this.level('LOG', objects) }
  info(...objects) { this.level('INFO', objects) }
  err(...objects) { this.level('ERROR', objects) }
}
