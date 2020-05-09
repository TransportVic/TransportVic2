const lineReader = require('line-reader')

class BufferedLineReader {

  constructor(file) {
    this.file = file
    this.unread = false
    this.previousLine = null
  }

  open() {
    return new Promise(resolve => {
      lineReader.open(this.file, (err, reader) => {
        this.reader = reader
        resolve()
      })
    })
  }

  available() {
    return this.reader.hasNextLine()
  }

  nextLine() {
    if (this.unread) {
      this.unread = false
      return this.previousLine
    }

    return new Promise(resolve => {
      this.reader.nextLine((err, line) => {
        this.previousLine = line
        resolve(line)
      })
    })
  }

  unreadLine() {
    this.unread = true
  }

  async close() {
    return new Promise(resolve => {
      this.reader.close(() => {
        resolve()
      })
    })
  }

}

module.exports = BufferedLineReader
