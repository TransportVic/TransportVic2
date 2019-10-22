const fs = require('fs')

async function fsWrap(f, ...args) {
  return new Promise((resolve, reject) => {
    fs[f](...args, (err, ...content) => {
      if (err) reject(err)
      else resolve(...content)
    })
  })
}

module.exports = async function setStats(field, datasize, loadTime) {
  let data = JSON.parse(await fsWrap('readFile', 'load-gtfs/stats.json'))
  data[field] = {
    datasize, loadTime
  }
  await fsWrap('writeFile', 'load-gtfs/stats.json', JSON.stringify(data))
}
