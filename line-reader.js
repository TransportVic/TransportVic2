const fs = require('fs')

var through2 = require('through2')
var StringDecoder = require('string_decoder').StringDecoder

function grep(filter) {
    var decoder = new StringDecoder('utf8'),
        last = ''

    var stream = through2({}, function transform(chunk, enc, cb) {
        var lines = decoder.write(last + chunk).split('\r\n'), i
        last = lines.pop()
        for (i = 0; i < lines.length; i++) {
            if (filter(lines[i])) this.push(lines[i])
        }
        lines = null
        cb()
    }, function flush(cb) {
        if (filter(last)) this.push(last)
        cb()
    })
    stream._readableState.objectMode = true
    return stream
}

function getLinesFilter(filename, filter) {
  return new Promise((resolve, reject) => {
    let fileStream = fs.createReadStream(filename, {
      bufferSize: 2 * 1024 * 1024,
      highWaterMark: 40 * 1024 * 1024
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

function getLines(filename, lineCount, skip) {
  return new Promise((resolve, reject) => {
    let stream = fs.createReadStream(filename, {
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
      // probably that last line is 'corrupt' - halfway read - why > not >=
      if (lines.length > lineCount + 1) {
        stream.destroy()
        lines = lines.slice(0, lineCount) // junk as above
        resolve({lines, length: data.length})
      }
    })

    stream.on('error', function (e) {
      reject(e)
    })

    stream.on('end', function () {
      resolve({lines, length: data.length})
      lines = null
    })
  })
}

module.exports = {
  getLines,
  getLinesFilter
}
