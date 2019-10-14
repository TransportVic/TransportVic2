const fs = require('fs')

const through2 = require('through2')
const StringDecoder = require('string_decoder').StringDecoder

function grep (filter) {
  let decoder = new StringDecoder('utf8')
  let last = ''

  let linesRead = 0

  let stream = through2({}, function transform (chunk, enc, cb) {
    let lines = decoder.write(last + chunk).split('\r\n'); let i
    last = lines.pop()
    for (i = 0; i < lines.length; i++) {
      if (filter(lines[i])) this.push(lines[i])
      if (++linesRead % 100000 == 0)
        console.log('LineReader: read in ' + linesRead + ' lines')
    }
    lines = null
    cb()
  }, function flush (cb) {
    if (filter(last)) this.push(last)
    cb()
  })
  stream._readableState.objectMode = true
  return stream
}

function getLinesFilter (filename, filter) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filename, {
      bufferSize: 4 * 1024 * 1024,
      highWaterMark: 50 * 1024 * 1024
    })
    let lineStream = fileStream.pipe(grep(filter))
    let lines = []

    lineStream.on('data', function (line) {
      lines.push(line)
    })

    lineStream.on('end', () => {
      resolve(lines)
      lines = null
      lineStream = null
    })
  })
}

function getLines (filename, lineCount, skip) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filename, {
      flags: 'r',
      encoding: 'utf-8',
      bufferSize: 64 * 1024,
      start: skip || 0
    })

    let data = ''
    let lines = []

    stream.on('data', function (moreData) {
      data += moreData
      lines = null
      lines = data.split('\n')
      if (lines.length > lineCount + 1) {
        stream.destroy()
        lines = lines.slice(0, lineCount + 1)
        resolve(lines)
      }
    })

    stream.on('error', function (e) {
      reject(e)
    })

    stream.on('end', function () {
      resolve(lines)
      lines = null
    })
  })
}

module.exports = {
  getLines,
  getLinesFilter
}
