const EventEmitter = require('events')

let lock

module.exports.createLock = () => {
  if (!lock) lock = new EventEmitter()
}

module.exports.releaseLock = () => {
  if (lock) {
    lock.emit('done')
    lock = null
  }
}

module.exports.awaitLock = async () => {
  if (lock) {
    return await new Promise(resolve => lock.on('done', resolve))
  }
}
