const fs = require('fs')
const path = require('path')
const utils = require('../../utils')

async function fsWrap(f, ...args) {
  return new Promise((resolve, reject) => {
    fs[f](...args, (err, ...content) => {
      if (err) reject(err)
      else resolve(...content)
    })
  })
}

module.exports = async function setStats(field, datasize) {
  let filePath = path.join(__dirname, '../stats.json')
  let data

  try {
    data = JSON.parse(await fsWrap('readFile', filePath))
  } catch (e) {
    data = {}
  }

  data[field] = {
    datasize, loadTime: utils.uptime()
  }
  await fsWrap('writeFile', filePath, JSON.stringify(data))
}

process.on('uncaughtException', err => {
  console.error(process.argv)
  console.error(err)
  process.exit(1)
})
