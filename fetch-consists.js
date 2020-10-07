const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const urls = require('./urls')

utils.request(urls.ptDatabase).then(data => {
  let consists = JSON.parse(data).map(train => [train.mCarA, train.tCar, train.mCarB])
  fs.writeFile(path.join(__dirname, 'additional-data/metro-consists.json'), JSON.stringify(consists), () => {})
})
